import { documentEvent } from './shorthands.js';

{
  /* Data */
  class Item {
    id;
    text = '';
    order;
    constructor({id, text = '', order} = {}) {
      if (id === undefined) {
        id = crypto.randomUUID();
      }
      if (order === undefined) {
        order = itemlistData.length;
      }
      this.id = id;
      this.text = text;
      this.order = order;
    }
    toJSON(key) {
      return {...this};
    }
  }

  class ItemlistItem extends Item {
    constructor(args) {
      super(args);
    }
  }

  class ChecklistItem extends Item {
    isChecked = false;
    constructor(args) {
      super(args);
      this.isChecked = args.isChecked ?? this.isChecked;
    }
  }

  const itemlistData = {
    lastModified: new Date(0),
    items: [],
  };
  const checklistData = {
    lastModified: new Date(0),
    items: [],
  };
  const checkedItems = [];

  document.addEventListener('addForm.add', function handleAdd(event) {
    const itemlistItem = new ItemlistItem({text: event.detail.text});
    const checklistItem = new ChecklistItem({text: event.detail.text});
    itemlistData.items.push(itemlistItem);
    checklistData.items.push(checklistItem);
    documentEvent('data.itemlist.add', {item: itemlistItem, isSingle: true});
    documentEvent('data.checklist.add', {item: checklistItem, isSingle: true});
    itemlistData.lastModified = new Date();
    checklistData.lastModified = new Date();
    persistItemlistData();
    persistChecklistData();
  });

  document.addEventListener('itemlist.item.add-to-checklist', function handleDelete(event) {
    checklistData.items.push(event.detail.item);
    documentEvent('data.checklist.add', {item: event.detail.item, isSingle: true});
    checklistData.lastModified = new Date();
    persistChecklistData();
  });

  document.addEventListener('checklist.item.delete', function handleDelete(event) {
    const itemIndex = checklistData.items.indexOf(event.detail.item);
    checklistData.items.splice(itemIndex, 1);
    checklistData.lastModified = new Date();
    persistChecklistData();
  });

  document.addEventListener('checklist.item.change', function handleChecked(event) {
    const item = event.detail.item;
    if (item.isChecked && ! checkedItems.includes(item.id)) {
      checkedItems.push(item.id);
    }
    else if ( ! item.isChecked && checkedItems.includes(item.id)) {
      checkedItems.splice(checkedItems.indexOf(item.id), 0);
    }
    persistChecklistData();
  });

  document.addEventListener('connection.receive.list.data', function handleData(event) {
    const message = event.detail.message;
    if (new Date(message.itemlistData.lastModified) > itemlistData.lastModified) {
      hydrateItemlistData(message.itemlistData);
      recreateItemlist();
      persistItemlistData();
    }
    if (new Date(message.checklistData.lastModified) > checklistData.lastModified) {
      hydrateChecklistData(message.checklistData);
      recreateChecklist();
      persistChecklistData();
    }
  });

  document.addEventListener('connection.peer.connected', function handleNewPeer(event) {
    documentEvent('connection.send', {
      address: event.detail.address,
      message: {
        type: 'list.data',
        itemlistData: itemlistData,
        checklistData: checklistData,
      },
    });
  });

  function persistItemlistData() {
    window.localStorage.setItem('itemlist-data', JSON.stringify(itemlistData));
  }

  function persistChecklistData() {
    window.localStorage.setItem('checked-items', JSON.stringify(checkedItems));
    window.localStorage.setItem('checklist-data', JSON.stringify(checklistData));
  }

  function hydrateItemlistData(jsonData) {
    itemlistData.lastModified = new Date(jsonData.lastModified);
    checklistData.items = [];
    for (const item of jsonData.items) {
      itemlistData.items.push(new ItemlistItem(item));
    }
  }

  function hydrateChecklistData(jsonData) {
    checklistData.lastModified = new Date(jsonData.lastModified);
    checklistData.items = [];
    for (const item of jsonData.items) {
      item.isChecked = checkedItems.includes(item.id);
      checklistData.items.push(new ChecklistItem(item));
    }
  }

  function recreateItemlist() {
    document.querySelector('.itemlist').replaceChildren();
    for (const item of itemlistData.items) {
      documentEvent('data.itemlist.add', {item: item, isSingle: false});
    }
  }

  function recreateChecklist() {
    document.querySelector('.checklist').replaceChildren();
    for (const item of checklistData.items) {
      documentEvent('data.checklist.add', {item: item, isSingle: false});
    }
  }

  window.addEventListener('DOMContentLoaded', function () {
    if (window.localStorage.getItem('itemlist-data')) {
      const data = JSON.parse(window.localStorage.getItem('itemlist-data'));
      hydrateItemlistData(data);
    }
    if (window.localStorage.getItem('checked-items')) {
      const itemIds = JSON.parse(window.localStorage.getItem('checked-items'));
      checkedItems.push(...itemIds);
    }
    if (window.localStorage.getItem('checklist-data')) {
      const data = JSON.parse(window.localStorage.getItem('checklist-data'));
      hydrateChecklistData(data);
    }
    recreateItemlist();
    recreateChecklist();
  });
}

{
  /* Itemlist */
  const itemlistContainer = document.querySelector('.itemlist-container');
  const itemlistElement = document.querySelector('.itemlist');
  document.addEventListener('data.itemlist.add', function (event) {
    const itemElement = document.createElement('itemlist-item');
    itemElement._item = event.detail.item;
    itemElement.addEventListener('itemlistitem.add-button', handleAddButton);
    if (event.detail.isSingle) {
      scrolToNewItem(itemElement);
    }
    itemlistElement.appendChild(itemElement);
  });
  const handleAddButton = function (event) {
    documentEvent('itemlist.item.add-to-checklist', {item: event.detail.item});
  };
  // Scroll to new item
  function scrolToNewItem(itemElement) {
    const handleItemLoaded = function () {
      itemlistContainer.scrollTop = itemlistContainer.scrollHeight;
      itemElement.removeEventListener('load', handleItemLoaded);
    };
    itemElement.addEventListener('load', handleItemLoaded);
  }
}

{
  /* Checklist */
  const checklistContainer = document.querySelector('.checklist-container');
  const checklistElement = document.querySelector('.checklist');
  const handleAdd = function (event) {
    const itemElement = document.createElement('checklist-item');
    itemElement._item = event.detail.item;
    itemElement.addEventListener('checklistitem.change', handleChange);
    itemElement.addEventListener('checklistitem.delete', handleDelete);
    if (event.detail.isSingle) {
      scrolToNewItem(itemElement);
    }
    checklistElement.appendChild(itemElement);
  };
  const handleChange = function (event) {
    if (event.detail.isChecked) {
      event.detail.item.isChecked = true;
    }
    else {
      event.detail.item.isChecked = false;
    }
    documentEvent('checklist.item.change', {item: event.detail.item});
  };
  const handleDelete = function (event) {
    checklistElement.removeChild(event.target);
    documentEvent('checklist.item.delete', {item: event.detail.item});
  };
  document.addEventListener('data.checklist.add', handleAdd);
  // Scroll to new item
  function scrolToNewItem(itemElement) {
    const handleItemLoaded = function () {
      checklistContainer.scrollTop = checklistContainer.scrollHeight;
      itemElement.removeEventListener('load', handleItemLoaded);
    };
    itemElement.addEventListener('load', handleItemLoaded);
  }
  // Extra scroll area above items
  let isFirstInteraction = true;
  document.addEventListener('pointerdown', handleFirstInteraction);
  document.addEventListener('wheel', handleFirstInteraction);
  checklistContainer.addEventListener('scroll', handleFirstInteraction);
  function handleFirstInteraction() {
    document.removeEventListener('pointerdown', handleFirstInteraction);
    document.removeEventListener('wheel', handleFirstInteraction);
    checklistContainer.removeEventListener('scroll', handleFirstInteraction);
    if ( ! isFirstInteraction) {
      return;
    }
    isFirstInteraction = false;
    const oldScrollHeight = checklistContainer.scrollHeight;
    checklistElement.style.marginTop = '75vh';
    checklistContainer.scrollTop += checklistContainer.scrollHeight - oldScrollHeight;
  }
}

{
  /* Edit mode toggle */
  const layoutElement = document.querySelector('.layout');
  const editModeToggle = document.querySelector('.editmode-toggle');

  const isActive = window.localStorage.getItem('editmode-active') ? JSON.parse(window.localStorage.getItem('editmode-active')) : false;
  layoutElement.classList.toggle('editmode-active', isActive);
  globalThis._editmodeIsActive = isActive;
  documentEvent('editmode.change', {isActive: isActive});

  editModeToggle.addEventListener('click', function handleClick() {
    const shouldActivate = layoutElement.classList.contains('editmode-active') === false;
    if (shouldActivate) {
      layoutElement.classList.add('editmode-active');
      window.localStorage.setItem('editmode-active', 'true');
      globalThis._editmodeIsActive = true;
      documentEvent('editmode.change', {isActive: true});
    }
    else {
      layoutElement.classList.remove('editmode-active');
      window.localStorage.setItem('editmode-active', 'false');
      globalThis._editmodeIsActive = false;
      documentEvent('editmode.change', {isActive: false});
    }
  });
}

{
  /* Add new form */
  const addForm = document.querySelector('.add-form');
  const input = addForm.querySelector('input');
  addForm.addEventListener('submit', function handleSubmit(event) {
    event.preventDefault();
    documentEvent('addForm.add', {text: input.value});
    input.value = '';
  });
}