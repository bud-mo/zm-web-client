/*
 * ***** BEGIN LICENSE BLOCK *****
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2004, 2005, 2006, 2007, 2008 Zimbra, Inc.
 * 
 * The contents of this file are subject to the Yahoo! Public License
 * Version 1.0 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * ***** END LICENSE BLOCK *****
 */

/**
 * Creates a dialog that lets the user select addresses from a contact list.
 * @constructor
 * @class
 * This class creates and manages a dialog that lets the user select addresses
 * from a contact list. Two lists are maintained, one with contacts to select
 * from, and one that contains the selected addresses. Between them are buttons
 * to shuffle addresses back and forth between the two lists.
 *
 * @author Conrad Damon
 * 
 * @param buttonInfo		[array]			transfer button IDs and labels
 */
ZmContactPicker = function(buttonInfo) {

	DwtDialog.call(this, {parent:appCtxt.getShell(), title:ZmMsg.selectAddresses});

	this._buttonInfo = buttonInfo;
	this._initialized = false;
	this._offset = 0;
	this._defaultQuery = ".";
	this._list = new AjxVector();

	this._searchErrorCallback = new AjxCallback(this, this._handleErrorSearch);
};

ZmContactPicker.prototype = new DwtDialog;
ZmContactPicker.prototype.constructor = ZmContactPicker;

// Consts

ZmContactPicker.CHOOSER_HEIGHT = 300;

// Public methods

ZmContactPicker.prototype.toString =
function() {
	return "ZmContactPicker";
};

/**
* Displays the contact picker dialog. The source list is populated with
* contacts, and the target list is populated with any addresses that are
* passed in. The address button that was used to popup the dialog is set
* as the active button.
*
* @param buttonId	[string]*	button ID of the button that called us
* @param addrs		[hash]*		hash of 3 vectors (one for each type of address)
* @param str		[string]*	initial search string
*/
ZmContactPicker.prototype.popup =
function(buttonId, addrs, str, account) {
	if (!this._initialized) {
		this._initialize(account);
		this._initialized = true;
	}
	else if (appCtxt.multiAccounts && this._account != account) {
		this._account = account;
		this._resetSelectDiv();
	}
	this._offset = 0;

	var searchFor = this._selectDiv ? this._selectDiv.getValue() : ZmContactsApp.SEARCHFOR_CONTACTS;

	// reset column sorting preference
	this._chooser.sourceListView.setSortByAsc(ZmItem.F_NAME, true);

	// reset button states
	this._chooser.reset();
	if (buttonId) {
		this._chooser._setActiveButton(buttonId);
	}

	// populate target list if addrs were passed in
	if (addrs) {
		for (var id in addrs) {
			this._chooser.addItems(addrs[id], DwtChooserListView.TARGET, true, id);
		}
	}

	// reset search field
	this._searchField.disabled = false;
	this._searchField.focus();
	if (str) {
		this._searchField.className = "";
		this._searchField.value = str;
		this._searchCleared = true;
	} else {
		this._searchField.className = "searchFieldHint";
		this._searchField.value = ZmMsg.contactPickerHint;
		this._searchCleared = false;
	}

	// reset paging buttons
	this._prevButton.setEnabled(false);
	this._nextButton.setEnabled(false);

	this.search(null, null, true);

	DwtDialog.prototype.popup.call(this);
};

/**
* Closes the dialog
*/
ZmContactPicker.prototype.popdown =
function() {
	// disable search field (hack to fix bleeding cursor)
	this._searchField.disabled = true;
	this._contactSource = null;
	this._list.removeAll();

	DwtDialog.prototype.popdown.call(this);
};

ZmContactPicker.prototype.search =
function(colItem, ascending, firstTime, lastId, lastSortVal) {
	if (!AjxUtil.isSpecified(ascending)) {
		ascending = true;
	}

	var query = this._searchCleared ? AjxStringUtil.trim(this._searchField.value) : "";
	if (!query.length) {
		query = this._defaultQuery;
	}

	var queryHint;
	if (this._selectDiv) {
		var searchFor = this._selectDiv.getValue();
		this._contactSource = (searchFor == ZmContactsApp.SEARCHFOR_CONTACTS || searchFor == ZmContactsApp.SEARCHFOR_PAS)
			? ZmItem.CONTACT
			: ZmId.SEARCH_GAL;

		if (searchFor == ZmContactsApp.SEARCHFOR_PAS) {
			queryHint = ZmSearchController.generateQueryForShares([ZmId.ITEM_CONTACT]) || "is:local";
		} else if (searchFor == ZmContactsApp.SEARCHFOR_CONTACTS) {
			queryHint = "is:local";
		} else if (searchFor == ZmContactsApp.SEARCHFOR_GAL) {
            ascending = true;
        }
	} else {
		this._contactSource = appCtxt.get(ZmSetting.CONTACTS_ENABLED, null, this._account)
			? ZmItem.CONTACT
			: ZmId.SEARCH_GAL;

		if (this._contactSource == ZmItem.CONTACT) {
			queryHint = "is:local";
		}
	}

	this._searchIcon.className = "DwtWait16Icon";

	// XXX: line below doesn't have intended effect (turn off column sorting for GAL search)
	this._chooser.sourceListView.sortingEnabled = (this._contactSource == ZmItem.CONTACT);

	var params = {
		obj: this,
		ascending: ascending,
		query: query,
		queryHint: queryHint,
		offset: this._offset,
		lastId: lastId,
		lastSortVal: lastSortVal,
		respCallback: (new AjxCallback(this, this._handleResponseSearch, [firstTime])),
		errorCallback: this._searchErrorCallback,
		accountName: (this._account && this._account.name)
	};
	ZmContactsHelper.search(params);
};

ZmContactPicker.prototype._contentHtml =
function(account) {
	var showSelect;
	if (appCtxt.multiAccounts) {
		var list = appCtxt.accountList.visibleAccounts;
		for (var i = 0; i < list.length; i++) {
			var account = list[i];
			if (appCtxt.get(ZmSetting.CONTACTS_ENABLED, null, account) &&
				(appCtxt.get(ZmSetting.GAL_ENABLED, null, account) ||
				 appCtxt.get(ZmSetting.SHARING_ENABLED, null, account)))
			{
				showSelect = true;
				break;
			}
		}
	} else {
		showSelect = (appCtxt.get(ZmSetting.CONTACTS_ENABLED) &&
					  (appCtxt.get(ZmSetting.GAL_ENABLED) ||
					   appCtxt.get(ZmSetting.SHARING_ENABLED)));
	}

	var subs = {
		id: this._htmlElId,
		showSelect: showSelect
	};

	return (AjxTemplate.expand("abook.Contacts#ZmContactPicker", subs));
};

ZmContactPicker.prototype._resetSelectDiv =
function() {
	this._selectDiv.clearOptions();

	if (appCtxt.get(ZmSetting.CONTACTS_ENABLED, null, this._account)) {
		this._selectDiv.addOption(ZmMsg.contacts, false, ZmContactsApp.SEARCHFOR_CONTACTS);

		if (appCtxt.get(ZmSetting.SHARING_ENABLED, null, this._account))
			this._selectDiv.addOption(ZmMsg.searchPersonalSharedContacts, false, ZmContactsApp.SEARCHFOR_PAS);
	}

	if (appCtxt.get(ZmSetting.GAL_ENABLED, null, this._account)) {
		this._selectDiv.addOption(ZmMsg.GAL, true, ZmContactsApp.SEARCHFOR_GAL);
	}

	if (!appCtxt.get(ZmSetting.INITIALLY_SEARCH_GAL, null, this._account) ||
		!appCtxt.get(ZmSetting.GAL_ENABLED, null, this._account))
	{
		this._selectDiv.setSelectedValue(ZmContactsApp.SEARCHFOR_CONTACTS);
	}
};

// called only when ZmContactPicker is first created. Sets up initial layout.
ZmContactPicker.prototype._initialize =
function(account) {

	// create static content and append to dialog parent
	this.setContent(this._contentHtml(account));

	this._searchIcon = document.getElementById(this._htmlElId + "_searchIcon");

	// add search button
	this._searchButton = new DwtButton({parent:this, parentElement:(this._htmlElId+"_searchButton")});
	this._searchButton.setText(ZmMsg.search);
	this._searchButton.addSelectionListener(new AjxListener(this, this._searchButtonListener));

	// add select menu
	var selectCellId = this._htmlElId + "_listSelect";
	var selectCell = document.getElementById(selectCellId);
	if (selectCell) {
		this._selectDiv = new DwtSelect({parent:this, parentElement:selectCellId});
		this._resetSelectDiv();
		this._selectDiv.addChangeListener(new AjxListener(this, this._searchTypeListener));
	} else {
		this.setSize("600");
	}

	// add chooser
	this._chooser = new ZmContactChooser({parent:this, buttonInfo:this._buttonInfo});
	this._chooser.reparentHtmlElement(this._htmlElId + "_chooser");
	this._chooser.resize(this.getSize().x-25, ZmContactPicker.CHOOSER_HEIGHT);

	// add paging buttons
	var pageListener = new AjxListener(this, this._pageListener);
	this._prevButton = new DwtButton({parent:this, parentElement:(this._htmlElId+"_pageLeft")});
	this._prevButton.setText(ZmMsg.previous);
	this._prevButton.setImage("LeftArrow");
	this._prevButton.addSelectionListener(pageListener);

	this._nextButton = new DwtButton({parent:this, style:DwtLabel.IMAGE_RIGHT, parentElement:(this._htmlElId+"_pageRight")});
	this._nextButton.setText(ZmMsg.next);
	this._nextButton.setImage("RightArrow");
	this._nextButton.addSelectionListener(pageListener);

	var pageContainer = document.getElementById(this._htmlElId + "_paging");
	if (pageContainer) {
		Dwt.setSize(pageContainer, this._chooser.sourceListView.getSize().x);
	}

	// init listeners
	this.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._okButtonListener));
	this.setButtonListener(DwtDialog.CANCEL_BUTTON, new AjxListener(this, this._cancelButtonListener));

	this._searchField = document.getElementById(this._htmlElId + "_searchField");
	Dwt.setHandler(this._searchField, DwtEvent.ONKEYPRESS, ZmContactPicker._keyPressHdlr);
	Dwt.setHandler(this._searchField, DwtEvent.ONCLICK, ZmContactPicker._onclickHdlr);
	this._keyPressCallback = new AjxCallback(this, this._searchButtonListener);
};

// Listeners

ZmContactPicker.prototype._searchButtonListener =
function(ev) {
	this._offset = 0;
	this._list.removeAll();
	this.search();
};

ZmContactPicker.prototype._handleResponseSearch =
function(firstTime, result) {
	var resp = result.getResponse();
	var more = resp.getAttribute("more");
	var offset = resp.getAttribute("offset");
	var isPagingSupported = AjxUtil.isSpecified(offset);
	var info = resp.getAttribute("info");
	var expanded = info && info[0].wildcard[0].expanded == "0";

	if (!firstTime && !isPagingSupported &&
		(expanded || (this._contactSource == ZmId.SEARCH_GAL && more)))
	{
		var d = appCtxt.getMsgDialog();
		d.setMessage(ZmMsg.errorSearchNotExpanded);
		d.popup();
		if (expanded) { return; }
	}

	var list = AjxVector.fromArray(ZmContactsHelper._processSearchResponse(resp));

	if (isPagingSupported) {
		this._list.merge(offset, list);
		this._list.hasMore = more;
	}

	if (list.size() == 0) {
		this._chooser.sourceListView._setNoResultsHtml();
	}

	this._showResults(isPagingSupported, more, list);
};

ZmContactPicker.prototype._showResults =
function(isPagingSupported, more, list) {
	// if offset is returned, then this account support gal paging
	if (this._contactSource == ZmId.SEARCH_GAL && !isPagingSupported) {
		this._prevButton.setEnabled(false);
		this._nextButton.setEnabled(false);
	} else {
		this._prevButton.setEnabled(this._offset > 0);
		this._nextButton.setEnabled(more);
	}

	this._resetColHeaders(); // bug #2269 - enable/disable sort column per type of search
	this._chooser.setItems(list);

	this._searchIcon.className = "ImgSearch";
	this._searchButton.setEnabled(true);
};

ZmContactPicker.prototype._handleErrorSearch =
function() {
	this._searchButton.setEnabled(true);
	return false;
};

ZmContactPicker.prototype._pageListener =
function(ev) {
	if (ev.item == this._prevButton) {
		this._offset -= ZmContactsApp.SEARCHFOR_MAX;
		this._showResults(true, true, this.getSubList()); // show cached results
	}
	else {
		var lastId;
		var lastSortVal;
		this._offset += ZmContactsApp.SEARCHFOR_MAX;
		var list = this.getSubList();
		if (!list) {
			list = this._chooser.sourceListView.getList();
			var email = (list.size() > 0) ? list.getLast() : null;
			if (email) {
				lastId = email.__contact.id;
				lastSortVal = email.__contact.sf;
			}
			this.search(null, null, null, lastId, lastSortVal);
		} else {
			var more = this._list.hasMore;
			if (!more) {
				more = (this._offset+ZmContactsApp.SEARCHFOR_MAX) < this._list.size();
			}
			this._showResults(true, more, list); // show cached results
		}
	}
};

ZmContactPicker.prototype.getSubList =
function() {
	var size = this._list.size();

	var end = (this._offset + ZmContactsApp.SEARCHFOR_MAX > size)
		? size : (this._offset + ZmContactsApp.SEARCHFOR_MAX);

	return (this._offset < end)
		? (AjxVector.fromArray(this._list.getArray().slice(this._offset, end))) : null;
};

ZmContactPicker.prototype._searchTypeListener =
function(ev) {
	var oldValue = ev._args.oldValue;
	var newValue = ev._args.newValue;

	if (oldValue != newValue) {
		this._searchButtonListener();
	}
};

ZmContactPicker.prototype._resetColHeaders =
function() {
	var slv = this._chooser.sourceListView;
	slv.headerColCreated = false;

	// find the participant column
	var part = 0;
	for (var i = 0; i < slv._headerList.length; i++) {
		if (slv._headerList[i]._field == ZmItem.F_NAME) {
			part = i;
			break;
		}
	}

	var sortable = (this._selectDiv && this._selectDiv.getValue() == ZmContactsApp.SEARCHFOR_GAL)
		? null : ZmItem.F_NAME;
	slv._headerList[part]._sortable = sortable;
	slv.createHeaderHtml(sortable);
};

// Done choosing addresses, add them to the compose form
ZmContactPicker.prototype._okButtonListener =
function(ev) {
	var data = this._chooser.getItems();
	DwtDialog.prototype._buttonListener.call(this, ev, [data]);
};

// Call custom popdown method
ZmContactPicker.prototype._cancelButtonListener =
function(ev) {
	DwtDialog.prototype._buttonListener.call(this, ev);
	this.popdown();
};

ZmContactPicker._keyPressHdlr =
function(ev) {
	var stb = DwtControl.getTargetControl(ev);
	var charCode = DwtKeyEvent.getCharCode(ev);
	if (!stb._searchCleared) {
		stb._searchField.className = stb._searchField.value = "";
		stb._searchCleared = true;
	}
	if (stb._keyPressCallback && (charCode == 13 || charCode == 3)) {
		stb._keyPressCallback.run();
		return false;
	}
	return true;
};

ZmContactPicker._onclickHdlr =
function(ev) {
	var stb = DwtControl.getTargetControl(ev);
	if (!stb._searchCleared) {
		stb._searchField.className = stb._searchField.value = "";
		stb._searchCleared = true;
	}
};

/***********************************************************************************/

/**
* This class creates a specialized chooser for the contact picker.
*
* @param parent			[DwtComposite]	the contact picker
* @param buttonInfo		[array]			transfer button IDs and labels
*/
ZmContactChooser = function(params) {
	DwtChooser.call(this, params);
};

ZmContactChooser.prototype = new DwtChooser;
ZmContactChooser.prototype.constructor = ZmContactChooser;

ZmContactChooser.prototype._createSourceListView =
function() {
	return new ZmContactChooserSourceListView(this);
};

ZmContactChooser.prototype._createTargetListView =
function() {
	return new ZmContactChooserTargetListView(this, (this._buttonInfo.length > 1));
};

/*
* The item is a AjxEmailAddress. Its address is used for comparison.
*
* @param item	[AjxEmailAddress]	an email address
* @param list	[AjxVector]			list to check in
*/
ZmContactChooser.prototype._isDuplicate =
function(item, list) {
	return list.containsLike(item, item.getAddress);
};

/***********************************************************************************/

/**
 * This class creates a specialized source list view for the contact chooser.
 */
ZmContactChooserSourceListView = function(parent) {
	DwtChooserListView.call(this, {parent:parent, type:DwtChooserListView.SOURCE, view:ZmId.VIEW_CONTACT_SRC});
	this.setScrollStyle(Dwt.CLIP);
};

ZmContactChooserSourceListView.prototype = new DwtChooserListView;
ZmContactChooserSourceListView.prototype.constructor = ZmContactChooserSourceListView;

ZmContactChooserSourceListView.prototype.toString =
function() {
	return "ZmContactChooserSourceListView";
};

ZmContactChooserSourceListView.prototype._getHeaderList =
function() {
	var headerList = [];
	headerList.push(new DwtListHeaderItem({field:ZmItem.F_TYPE, icon:"Folder", width:ZmMsg.COLUMN_WIDTH_FOLDER_CN}));
	headerList.push(new DwtListHeaderItem({field:ZmItem.F_NAME, text:ZmMsg._name, width:ZmMsg.COLUMN_WIDTH_NAME_CN}));
	headerList.push(new DwtListHeaderItem({field:ZmItem.F_EMAIL, text:ZmMsg.email}));

	return headerList;
};

ZmContactChooserSourceListView.prototype._mouseOverAction =
function(ev, div) {
	DwtChooserListView.prototype._mouseOverAction.call(this, ev, div);
	var id = ev.target.id || div.id;
	var item = this.getItemFromElement(div);

	if (id && item) {
		var contact = item.__contact;
		if (contact) {
			var tt = contact.getToolTip(item.address, contact.isGal);
			this.setToolTipContent(tt);
		} else {
			this.setToolTipContent(item.address);
		}
	} else {
		this.setToolTipContent(null);
	}

	return true;
};

ZmContactChooserSourceListView.prototype._getCellContents =
function(html, idx, item, field, colIdx, params) {
	return ZmContactsHelper._getEmailField(html, idx, item, field, colIdx, params);
};

/***********************************************************************************/

/**
 * This class creates a specialized target list view for the contact chooser.
 */
ZmContactChooserTargetListView = function(parent, showType) {
	this._showType = showType; // call before base class since base calls getHeaderList

	DwtChooserListView.call(this, {parent:parent, type:DwtChooserListView.TARGET,
								   view:ZmId.VIEW_CONTACT_TGT});

	this.setScrollStyle(Dwt.CLIP);
};

ZmContactChooserTargetListView.prototype = new DwtChooserListView;
ZmContactChooserTargetListView.prototype.constructor = ZmContactChooserTargetListView;

ZmContactChooserTargetListView.prototype.toString =
function() {
	return "ZmContactChooserTargetListView";
};

ZmContactChooserTargetListView.prototype._getHeaderList =
function() {
	var headerList = [];
	var view = this._view;
	if (this._showType) {
		headerList.push(new DwtListHeaderItem({field:ZmItem.F_TYPE, icon:"ContactsPicker", width:ZmMsg.COLUMN_WIDTH_TYPE_CN}));
	}
	headerList.push(new DwtListHeaderItem({field:ZmItem.F_NAME, text:ZmMsg._name, width:ZmMsg.COLUMN_WIDTH_NAME_CN}));
	headerList.push(new DwtListHeaderItem({field:ZmItem.F_EMAIL, text:ZmMsg.email}));

	return headerList;
};

ZmContactChooserTargetListView.prototype._mouseOverAction =
ZmContactChooserSourceListView.prototype._mouseOverAction;

// The items are AjxEmailAddress objects
ZmContactChooserTargetListView.prototype._getCellContents =
function(html, idx, item, field, colIdx, params) {
	if (field == ZmItem.F_TYPE) {
		item.setType(item._buttonId);
		html[idx++] = ZmMsg[item.getTypeAsString()];
		html[idx++] = ":";
	} else {
		idx = ZmContactsHelper._getEmailField(html, idx, item, field, colIdx);
	}
	return idx;
};
