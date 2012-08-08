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

Components.utils.import("resource://enigmail/enigmailCommon.jsm");

// Initialize enigmailCommon
EnigInitCommon("pref-enigmail");

var gMimePartsElement, gMimePartsValue, gAdvancedMode;

function prefOnLoad() {

   EnigDisplayPrefs(false, true, false);
   document.getElementById("enigmail_agentPath").value = EnigConvertToUnicode(EnigGetPref("agentPath"), "utf-8");

   gAdvancedMode = EnigGetPref("advancedUser");

   if (window.arguments) {
      if (! window.arguments[0].showBasic) {
          // hide basic tab
          document.getElementById("basic").setAttribute("collapsed", true);
          document.getElementById("basicTab").setAttribute("collapsed", true);
          selectPrefTabPanel("sendTab");
      }
      else {
        EnigCollapseAdvanced(document.getElementById("prefTabBox"), "collapsed", null);
        EnigCollapseAdvanced(document.getElementById("enigPrefTabPanel"), "hidden", null);
        enigShowUserModeButtons(gAdvancedMode);
      }

      if ((typeof window.arguments[0].selectTab)=="string") {
          selectPrefTabPanel(window.arguments[0].selectTab);
      }

   }
   else {
    enigShowUserModeButtons(gAdvancedMode);
   }

   if ((! window.arguments) || (window.arguments[0].clientType!="seamonkey")) {
      document.getElementById("enigmail_disableSMIMEui").setAttribute("collapsed", true);
      var uninst = document.getElementById("uninstall");
      if (uninst) uninst.setAttribute("collapsed", "true");
      EnigCollapseAdvanced(document.getElementById("prefTabBox"), "collapsed", null);
      EnigCollapseAdvanced(document.getElementById("enigPrefTabPanel"), "hidden", null);

   }

   EnigDisplayRadioPref("recipientsSelection", EnigGetPref("recipientsSelection"),
                        gEnigRecipientsSelection);

   gMimePartsElement = document.getElementById("mime_parts_on_demand");

   try {
     gMimePartsValue = EnigmailCommon.prefRoot.getBoolPref("mail.server.default.mime_parts_on_demand");
   } catch (ex) {
     gMimePartsValue = true;
   }

   if (gMimePartsValue) {
     gMimePartsElement.setAttribute("checked", "true");
   } else {
     gMimePartsElement.removeAttribute("checked");
   }

   var overrideGpg = document.getElementById("enigOverrideGpg")
   if (EnigGetPref("agentPath")) {
      overrideGpg.checked = true;
   }
   else {
      overrideGpg.checked = false;
   }
   enigActivateDependent(overrideGpg, "enigmail_agentPath enigmail_browsePath");
   activateRulesButton(document.getElementById("enigmail_recipientsSelection"), "openRulesEditor");

   var testEmailElement = document.getElementById("enigmail_test_email");
   var userIdValue = EnigGetPref("userIdValue");

   enigDetermineGpgPath();

   if (testEmailElement && userIdValue)
     testEmailElement.value = userIdValue;

}

function enigDetermineGpgPath() {
  if (! gEnigmailSvc) {
    try {
      gEnigmailSvc = ENIG_C[ENIG_ENIGMAIL_CONTRACTID].createInstance(ENIG_I.nsIEnigmail);
      if (! gEnigmailSvc.initialized) {
        // attempt to initialize Enigmail
        gEnigmailSvc.initialize(window, EnigGetVersion(), gPrefEnigmail);
      }
    } catch (ex) {}
  }

  if (gEnigmailSvc.initialized && typeof(gEnigmailSvc.agentPath) == "object") {
    try {
      var agentPath = "";
      if (EnigGetOS() == "WINNT") {
        agentPath = EnigGetFilePath(gEnigmailSvc.agentPath).replace(/\\\\/g, "\\");
      }
      else {
        agentPath = gEnigmailSvc.agentPath.path;
        // EnigGetFilePath(gEnigmailSvc.agentPath); // .replace(/\\\\/g, "\\");
      }
      if (agentPath.length > 50) {
        agentPath = agentPath.substring(0,50)+"..."
      }
      document.getElementById("enigmailGpgPath").setAttribute("value", EnigGetString("prefs.gpgFound", agentPath));
    }
    catch(ex) {
      document.getElementById("enigmailGpgPath").setAttribute("value", "error 2");
    }
  }
  else {
    document.getElementById("enigmailGpgPath").setAttribute("value", EnigGetString("prefs.gpgNotFound"));
  }
}

function selectPrefTabPanel(panelName) {
  var prefTabs=document.getElementById("prefTabs");
  var selectTab=document.getElementById(panelName);
  prefTabs.selectedTab = selectTab;
}

function resetPrefs() {
  DEBUG_LOG("pref-enigmail.js: resetPrefs\n");

  EnigDisplayPrefs(true, true, false);

  EnigSetPref("configuredVersion", EnigGetVersion());

  EnigDisplayRadioPref("recipientsSelection", EnigGetPref("recipientsSelection"),
                      gEnigRecipientsSelection);

}

function resetRememberedValues() {
  DEBUG_LOG("pref-enigmail.js: resetRememberedValues\n");
  var prefs=["confirmBeforeSend",
             "displaySignWarn",
             "encryptAttachmentsSkipDlg",
             "initAlert",
             "mimePreferPgp",
             "quotedPrintableWarn",
             "saveEncrypted",
             "warnOnRulesConflict",
             "warnGpgAgentAndIdleTime",
             "warnClearPassphrase",
             "warnOnSendingNewsgroups",
             "warnIso2022jp",
             "warnRefreshAll"];

  for (var j=0; j<prefs.length; j++) {
    EnigSetPref(prefs[j], EnigGetDefaultPref(prefs[j]));
  }
  EnigAlert(EnigGetString("warningsAreReset"));
}

function prefOnAccept() {

  DEBUG_LOG("pref-enigmail.js: prefOnAccept\n");

  var autoKey = document.getElementById("enigmail_autoKeyRetrieve").value;

  if (autoKey.search(/.[ ,;\t]./)>=0)  {
    EnigAlert(EnigGetString("prefEnigmail.oneKeyserverOnly"));
    return false;
  }

  var oldAgentPath = EnigGetPref("agentPath");

  if (! document.getElementById("enigOverrideGpg").checked) {
    document.getElementById("enigmail_agentPath").value = "";
  }
  var newAgentPath = document.getElementById("enigmail_agentPath").value;

  EnigDisplayPrefs(false, false, true);
  EnigSetPref("agentPath", EnigConvertFromUnicode(newAgentPath, "utf-8"));

  //setRecipientsSelectionPref(document.getElementById("enigmail_recipientsSelection").value);
  //EnigSetRadioPref("recipientsSelection", gEnigRecipientsSelection);

  if (gMimePartsElement &&
      (gMimePartsElement.checked != gMimePartsValue) ) {

    EnigmailCommon.prefRoot.setBoolPref("mail.server.default.mime_parts_on_demand", (gMimePartsElement.checked ? true : false));
  }

  EnigSetPref("configuredVersion", EnigGetVersion());
  EnigSetPref("advancedUser", gAdvancedMode);

  EnigSavePrefs();

  if (oldAgentPath != newAgentPath) {
    if (! gEnigmailSvc) {
      try {
        gEnigmailSvc = ENIG_C[ENIG_ENIGMAIL_CONTRACTID].createInstance(ENIG_I.nsIEnigmail);
      } catch (ex) {}
    }

    if (gEnigmailSvc.initialized) {
      try {
        gEnigmailSvc.reinitialize();
      }
      catch (ex) {
        EnigError(EnigGetString("invalidGpgPath"));
      }
    }
    else {
      gEnigmailSvc = null;
      GetEnigmailSvc();
    }
  }

  // detect use of gpg-agent and warn if needed
  var enigmailSvc = GetEnigmailSvc();
  if (enigmailSvc && enigmailSvc.useGpgAgent()) {
    if ((document.getElementById("enigmail_maxIdleMinutes").value > 0) &&
        (! document.getElementById("enigmail_noPassphrase").checked)) {
      EnigAlertPref(EnigGetString("prefs.warnIdleTimeWithGpgAgent"), "warnGpgAgentAndIdleTime");
    }
  }


  return true;
}

function enigActivateDependent (obj, dependentIds) {
  var idList = dependentIds.split(/ /);
  var depId;

  for (depId in idList) {
    if (obj.checked) {
      document.getElementById(idList[depId]).removeAttribute("disabled");
    }
    else {
      document.getElementById(idList[depId]).setAttribute("disabled", "true");
    }
  }
  return true;
}

function enigShowUserModeButtons(expertUser) {
  var advUserButton = document.getElementById("enigmail_advancedUser");
  var basicUserButton = document.getElementById("enigmail_basicUser");
  if (! expertUser) {
    basicUserButton.setAttribute("hidden", true);
    advUserButton.removeAttribute("hidden");
  }
  else {
    advUserButton.setAttribute("hidden", true);
    basicUserButton.removeAttribute("hidden");
  }
}

function enigSwitchAdvancedMode(expertUser) {

  var origPref = EnigGetPref("advancedUser");
  enigShowUserModeButtons(expertUser);
  gAdvancedMode = expertUser;

  if (expertUser) {
    EnigSetPref("advancedUser", true);
  }
  else {
    EnigSetPref("advancedUser", false);
  }

  var prefTabBox  = document.getElementById("prefTabBox");
  if (prefTabBox) {
    // Thunderbird
    EnigCollapseAdvanced(document.getElementById("enigPrefTabPanel"), "hidden", null);
    EnigCollapseAdvanced(prefTabBox, "collapsed", null);
  }
  else {
    // Seamonkey
    EnigCollapseAdvanced(document.getElementById("enigmailPrefsBox"), "hidden", null);
  }
  EnigSetPref("advancedUser", origPref);
}

function enigAlertAskNever () {
  EnigAlert(EnigGetString("prefs.warnAskNever"));
}

function activateRulesButton(radioListObj, buttonId) {
  switch (radioListObj.value) {
  case "3":
  case "4":
    document.getElementById(buttonId).setAttribute("disabled", "true");
    break;
  default:
    document.getElementById(buttonId).removeAttribute("disabled");
  }
}


function EnigMimeTest() {
  CONSOLE_LOG("\n\nEnigMimeTest: START ********************************\n");

  var lines = ["content-type: multipart/mixed;\r",
               "\n boundary=\"ABCD\"",
               "\r\n\r\nmultipart\r\n--ABCD\r",
               "\ncontent-type: text/html \r\n",
               "\r\n<html><body><b>TEST CONTENT1<b></body></html>\r\n\r",
               "\n--ABCD\r\ncontent-type: text/plain\r\ncontent-disposition:",
               " attachment; filename=\"abcd.txt\"\r\n",
               "\r\nFILE CONTENTS\r\n--ABCD--\r\n"];

  var linebreak = ["CRLF", "LF", "CR"];

  for (var j=0; j<linebreak.length; j++) {
    var listener = enigCreateInstance(ENIG_IPCBUFFER_CONTRACTID, "nsIIPCBuffer");

    listener.open(2000, false);

    var mimeFilter = enigCreateInstance(ENIG_ENIGMIMELISTENER_CONTRACTID, "nsIEnigMimeListener");

    mimeFilter.init(listener, null, 4000, j != 1, j == 1, false);

    for (var k=0; k<lines.length; k++) {
      var line = lines[k];
      if (j == 1) line = line.replace(/\r/g, "");
      if (j == 2) line = line.replace(/\n/g, "");
      mimeFilter.write(line, line.length, null, null);
    }

    mimeFilter.onStopRequest(null, null, 0);

    CONSOLE_LOG(linebreak[j]+" mimeFilter.contentType='"+mimeFilter.contentType+"'\n");
    CONSOLE_LOG(linebreak[j]+" listener.getData()='"+listener.getData().replace(/\r/g, "\\r")+"'\n");
  }

  CONSOLE_LOG("************************************************\n");
}


function EnigTest() {
  var plainText = "TEST MESSAGE 123\nTEST MESSAGE 345\n";
  var testEmailElement = document.getElementById("enigmail_test_email");
  var toMailAddr = testEmailElement.value;

  var enigmailSvc = GetEnigmailSvc();
  if (!enigmailSvc) {
    EnigAlert(EnigGetString("testNoSvc"));
    return;
  }

  if (!toMailAddr) {

    try {
      EnigMimeTest();
    } catch (ex) {}

    EnigAlert(EnigGetString("testNoEmail"));
    return;
  }

  try {
    CONSOLE_LOG("\n\nEnigTest: START ********************************\n");
    CONSOLE_LOG("EnigTest: To: "+toMailAddr+"\n"+plainText+"\n");

    var uiFlags = nsIEnigmail.UI_INTERACTIVE;

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj    = new Object();

    var cipherText = enigmailSvc.encryptMessage(window, uiFlags, null, plainText,
                                                toMailAddr, toMailAddr, "",
                                                nsIEnigmail.SEND_SIGNED,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);
    CONSOLE_LOG("************************************************\n");
    CONSOLE_LOG("EnigTest: SIGNING ONLY\n");
    CONSOLE_LOG("EnigTest: cipherText = "+cipherText+"\n");
    CONSOLE_LOG("EnigTest: exitCode = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    var signatureObj   = new Object();
    var keyIdObj       = new Object();
    var userIdObj      = new Object();
    var sigDetailsObj  = new Object();
    var blockSeparationObj  = new Object();

    var decryptedText = enigmailSvc.decryptMessage(window,
                                        uiFlags, cipherText,
                                        signatureObj, exitCodeObj,
                                        statusFlagsObj, keyIdObj, userIdObj,
                                        sigDetailsObj,
                                        errorMsgObj,
                                        blockSeparationObj);

    CONSOLE_LOG("\n************************************************\n");
    CONSOLE_LOG("EnigTest: VERIFICATION\n");
    CONSOLE_LOG("EnigTest: decryptedText = "+decryptedText+"\n");
    CONSOLE_LOG("EnigTest: exitCode  = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("EnigTest: signature = "+signatureObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    cipherText = enigmailSvc.encryptMessage(window, uiFlags, null, plainText,
                                                toMailAddr, toMailAddr, "",
                                                nsIEnigmail.SEND_SIGNED|
                                                nsIEnigmail.SEND_ENCRYPTED,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);
    CONSOLE_LOG("************************************************\n");
    CONSOLE_LOG("EnigTest: SIGNING + ENCRYPTION\n");
    CONSOLE_LOG("EnigTest: cipherText = "+cipherText+"\n");
    CONSOLE_LOG("EnigTest: exitCode = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    decryptedText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                        signatureObj, exitCodeObj,
                                        statusFlagsObj, keyIdObj, userIdObj,
                                        sigDetailsObj,
                                        errorMsgObj, blockSeparationObj);

    CONSOLE_LOG("\n************************************************\n");
    CONSOLE_LOG("EnigTest: DECRYPTION\n");
    CONSOLE_LOG("EnigTest: decryptedText = "+decryptedText+"\n");
    CONSOLE_LOG("EnigTest: exitCode  = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("EnigTest: signature = "+signatureObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    EnigAlert(EnigGetString("testSucceeded"));
  }
  catch (ex) {
    EnigAlert(EnigGetString("undefinedError"));
  }
}

function enigLocateGpg() {
  var fileName="gpg";
  var ext="";
  if (EnigGetOS() == "WINNT") {
    ext=".exe";
  }
  var filePath = EnigFilePicker(EnigGetString("locateGpg"),
                           "", false, ext,
                           fileName+ext, null);
  if (filePath) {
//     if (EnigmailCommon.getOS() == "WINNT") {
//       document.getElementById("enigmail_agentPath").value = EnigGetFilePath(filePath);
//     }
    document.getElementById("enigmail_agentPath").value = filePath.path
  }
}
