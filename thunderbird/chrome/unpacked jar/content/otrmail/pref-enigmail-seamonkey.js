/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@mozilla-enigmail.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

// Uses: chrome://enigmail/content/enigmailCommon.js
// Uses: chrome://enigmail/content/pref-enigmail-adv.js

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail-seamonkey");

var gAdvancedMode;

function initPrefSeamonkey() {
  DEBUG_LOG("pref-enigmail-seamonkey.js: initPrefSeamonkey\n");
  parent.initPanel('chrome://enigmail/content/pref-enigmail-seamonkey.xul');

  gAdvancedMode = EnigGetPref("advancedUser");
  EnigCollapseAdvanced(document.getElementById("enigmailPrefsBox"), "hidden", null);
  enigShowUserModeButtons(gAdvancedMode);

  enigDetermineGpgPath();

  EnigSetPref("configuredVersion", EnigGetVersion());

  setDisables(true);
}

function setDisables(initializing) {
  DEBUG_LOG("pref-enigmail-seamonkey.js: setDisables: "+initializing+"\n");

  var noPassphraseElement = document.getElementById("noPassphrase");
  var noPassphrase = initializing ? EnigGetPref("noPassphrase")
                              : noPassphraseElement.checked;

  var overrideGpg = document.getElementById("enigOverrideGpg")
  if (EnigGetPref("agentPath")) {
    overrideGpg.checked = true;
  }
  else {
    overrideGpg.checked = false;
  }
  enigActivateDependent(overrideGpg, "enigmail_agentPath enigmail_browsePath");
}

function prefSeamonkeyOnClose() {
  DEBUG_LOG("pref-enigmail-seamonkey.js: prefSeamonkeyOnClose:\n");

  if (! document.getElementById("enigOverrideGpg").checked) {
    EnigSetPref("agentPath", "");
  }
  EnigSetPref("advancedUser", gAdvancedMode);
}

