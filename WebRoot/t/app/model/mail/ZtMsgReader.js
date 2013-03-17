/*
 * ***** BEGIN LICENSE BLOCK *****
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2013 Zimbra, Inc.
 *
 * The contents of this file are subject to the Zimbra Public License
 * Version 1.3 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * ***** END LICENSE BLOCK *****
 */

/**
 * This class translates JSON for a message into a ZtMailMsg.
 *
 * @author Conrad Damon <cdamon@zimbra.com>
 */
Ext.define('ZCS.model.mail.ZtMsgReader', {

	extend: 'ZCS.model.mail.ZtMailReader',

	requires: [
		'ZCS.model.mail.ZtMimePart',
		'ZCS.model.mail.ZtInvite'
	],

	alias: 'reader.msgreader',

	// SendMsgResponse hands us back empty msg object, no need to process it
	getRoot: function(data, nodeName) {
		return (data.soapMethod === 'SendMsg') ? null : this.callParent(arguments);
	},

	/**
	 * Override so we can figure out which message will be the last one displayed, so we know not
	 * to hide its quoted content.
	 */
	getRecords: function(root) {

		if (!root) {
			return [];
		}

		var records = [],
			ln = root.length, i,
			lastIndex = -1,
			firstMsg = root[0],
			conv = firstMsg && ZCS.cache.get(firstMsg.cid),
			numMsgs = conv && conv.get('numMsgs'),
			searchFolder = ZCS.session.getCurrentSearchOrganizer(),
			searchFolderId = searchFolder && searchFolder.get('itemId');

		if (ln === numMsgs) {
			// Find the last displayable (non-Trash, non-Junk) message (which will not
			// have quoted content hidden when it is displayed)
			for (i = ln - 1; i >= 0; i--) {
				var node = root[i],
					localId = ZCS.util.parseId(node.l).localId;

				if ((localId === searchFolderId) || !ZCS.constant.CONV_HIDE[localId]) {
					lastIndex = i;
					break;
				}
			}
		}

		// Process each msg from JSON to data
		for (i = 0; i < ln; i++) {
			var node = root[i],
				localId = ZCS.util.parseId(node.l).localId;

			if ((localId === searchFolderId) || !ZCS.constant.CONV_HIDE[localId]) {
				records.push({
					clientId: null,
					id: node.id,
					data: this.getDataFromNode(node, i === lastIndex),
					node: node
				});
			}
		}

		return records;
	},

	getDataFromNode: function(node, isLast) {

		var data = {},
			ctxt;

		data.itemId         = node.id;
		data.type           = ZCS.constant.ITEM_MESSAGE;
		data.folderId       = node.l;
		data.fragment       = node.fr;
		data.convId         = node.cid;
		data.subject        = node.su;
		data.date           = node.d;
		data.sentDate       = node.sd;
		data.messageId      = node.mid;
		data.irtMessageId   = node.irt;

		this.parseFlags(node, data);

		data.addresses = ZCS.model.mail.ZtMailItem.convertAddressJsonToModel(node.e);

		data.dateStr = ZCS.util.getRelativeDateString(node.d);

		data.tags = ZCS.model.ZtItem.parseTags(node.t);

		if (node.mp) {
			ctxt = {
				attachments:    [],
				bodyParts:      [],
				contentTypes:   {}
			}
			data.topPart = ZCS.model.mail.ZtMimePart.fromJson(node.mp[0], ctxt);
			data.attachments = ctxt.attachments;
			data.bodyParts = ctxt.bodyParts;
			data.contentTypes = ctxt.contentTypes;
			data.isLoaded = !!(data.bodyParts.length > 0 || data.attachments.length > 0);
		}

		data.isLast = isLast;

		if (node.inv) {
			data.invite = ZCS.model.mail.ZtInvite.fromJson(node.inv[0], node.id);
		}

		return data;
	}
});