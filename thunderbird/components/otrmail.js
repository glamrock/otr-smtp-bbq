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


Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://enigmail/subprocess.jsm");
Components.utils.import("resource://enigmail/pipeConsole.jsm");
Components.utils.import("resource://enigmail/pipeTransport.jsm");
Components.utils.import("resource://gre/modules/ctypes.jsm");

// Maximum size of message directly processed by Enigmail
const MSG_BUFFER_SIZE = 98304;   // 96 kB
const MAX_MSG_BUFFER_SIZE = 512000 // slightly less than 512 kB

const ERROR_BUFFER_SIZE = 32768; // 32 kB

const gDummyPKCS7 = 'Content-Type: multipart/mixed;\r\n boundary="------------060503030402050102040303\r\n\r\nThis is a multi-part message in MIME format.\r\n--------------060503030402050102040303\r\nContent-Type: application/x-pkcs7-mime\r\nContent-Transfer-Encoding: 8bit\r\n\r\n\r\n--------------060503030402050102040303\r\nContent-Type: application/x-enigmail-dummy\r\nContent-Transfer-Encoding: 8bit\r\n\r\n\r\n--------------060503030402050102040303--\r\n';

/* Implementations supplied by this module */
const NS_ENIGMAIL_CONTRACTID   = "@mozdev.org/enigmail/enigmail;1";
const NS_PGP_MODULE_CONTRACTID = "@mozilla.org/mimecth/pgp;1";

const NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID =
    "@mozilla.org/network/protocol;1?name=enigmail";

const NS_ENIGMAIL_CID =
  Components.ID("{847b3a01-7ab1-11d4-8f02-006008948af5}");

const NS_ENIGMAILPROTOCOLHANDLER_CID =
  Components.ID("{847b3a11-7ab1-11d4-8f02-006008948af5}");

const NS_PGP_MODULE_CID =
  Components.ID("{847b3af1-7ab1-11d4-8f02-006008948af5}");

const NS_ENIGMSGCOMPOSE_CID =
  Components.ID("{847b3a21-7ab1-11d4-8f02-006008948af5}");

const NS_ENIGMSGCOMPOSEFACTORY_CID =
  Components.ID("{847b3a22-7ab1-11d4-8f02-006008948af5}");

const NS_ENIGCLINE_SERVICE_CID =
  Components.ID("{847b3ab1-7ab1-11d4-8f02-006008948af5}");

const ENIGMAIL_EXTENSION_ID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";

// Contract IDs and CIDs used by this module
const NS_IPCBUFFER_CONTRACTID   = "@mozilla.org/ipc/ipc-buffer;1";
const NS_PROCESS_UTIL_CONTRACTID = "@mozilla.org/process/util;1"
const NS_MSGCOMPOSESECURE_CONTRACTID = "@mozilla.org/messengercompose/composesecure;1";
const NS_ENIGMSGCOMPOSE_CONTRACTID   = "@mozilla.org/enigmail/composesecure;1";
const NS_ENIGMSGCOMPOSEFACTORY_CONTRACTID   = "@mozilla.org/enigmail/composesecure-factory;1";
const NS_ENIGMIMESERVICE_CONTRACTID = "@mozdev.org/enigmail/enigmimeservice;1";
const NS_SIMPLEURI_CONTRACTID   = "@mozilla.org/network/simple-uri;1";
const NS_TIMER_CONTRACTID       = "@mozilla.org/timer;1";
const NS_OBSERVERSERVICE_CONTRACTID = "@mozilla.org/observer-service;1";
const NS_PROMPTSERVICE_CONTRACTID = "@mozilla.org/embedcomp/prompt-service;1";
const ASS_CONTRACTID = "@mozilla.org/appshell/appShellService;1";
const WMEDIATOR_CONTRACTID = "@mozilla.org/appshell/window-mediator;1";
const NS_IOSERVICE_CONTRACTID       = "@mozilla.org/network/io-service;1";
const NS_ISCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";
const NS_SCRIPTABLEINPUTSTREAM_CONTRACTID = "@mozilla.org/scriptableinputstream;1"
const ENIG_STRINGBUNDLE_CONTRACTID = "@mozilla.org/intl/stringbundle;1";
const NS_DOMPARSER_CONTRACTID = "@mozilla.org/xmlextras/domparser;1";
const NS_DOMSERIALIZER_CONTRACTID = "@mozilla.org/xmlextras/xmlserializer;1";
const NS_CLINE_SERVICE_CONTRACTID = "@mozilla.org/enigmail/cline-handler;1";
const NS_EXTENSION_MANAGER_CONTRACTID = "@mozilla.org/extensions/manager;1"
const NS_XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";


const DIR_SERV_CONTRACTID  = "@mozilla.org/file/directory_service;1"

const Cc = Components.classes;
const Ci = Components.interfaces;

// Interfaces
const nsISupports            = Ci.nsISupports;
const nsIObserver            = Ci.nsIObserver;
const nsIProtocolHandler     = Ci.nsIProtocolHandler;
const nsIEnvironment         = Ci.nsIEnvironment;
const nsIEnigmail            = Ci.nsIEnigmail;
const nsIEnigStrBundle       = Ci.nsIStringBundleService;
const nsICmdLineHandler      = Ci.nsICmdLineHandler;
const nsIWindowWatcher       = Ci.nsIWindowWatcher;
const nsICommandLineHandler  = Ci.nsICommandLineHandler;
const nsIWindowsRegKey       = Ci.nsIWindowsRegKey;
const nsIFactory             = Ci.nsIFactory

const NS_XPCOM_SHUTDOWN_OBSERVER_ID = "xpcom-shutdown";

var Ec = null;

///////////////////////////////////////////////////////////////////////////////
// Global variables

const GPG_COMMENT_OPT = "Using GnuPG with %s - http://enigmail.mozdev.org/";

var gLogLevel = 3;            // Output only errors/warnings by default

var gEnigmailSvc = null;      // Global Enigmail Service
var gEnigStrBundle;           // Global string bundle

// GPG status flags mapping (see doc/DETAILS file in the GnuPG distribution)
var gStatusFlags = {GOODSIG:         nsIEnigmail.GOOD_SIGNATURE,
                    BADSIG:          nsIEnigmail.BAD_SIGNATURE,
                    ERRSIG:          nsIEnigmail.UNVERIFIED_SIGNATURE,
                    EXPSIG:          nsIEnigmail.EXPIRED_SIGNATURE,
                    REVKEYSIG:       nsIEnigmail.GOOD_SIGNATURE,
                    EXPKEYSIG:       nsIEnigmail.EXPIRED_KEY_SIGNATURE,
                    KEYEXPIRED:      nsIEnigmail.EXPIRED_KEY,
                    KEYREVOKED:      nsIEnigmail.REVOKED_KEY,
                    NO_PUBKEY:       nsIEnigmail.NO_PUBKEY,
                    NO_SECKEY:       nsIEnigmail.NO_SECKEY,
                    IMPORTED:        nsIEnigmail.IMPORTED_KEY,
                    INV_RECP:        nsIEnigmail.INVALID_RECIPIENT,
                    MISSING_PASSPHRASE: nsIEnigmail.MISSING_PASSPHRASE,
                    BAD_PASSPHRASE:  nsIEnigmail.BAD_PASSPHRASE,
                    BADARMOR:        nsIEnigmail.BAD_ARMOR,
                    NODATA:          nsIEnigmail.NODATA,
                    ERROR:           nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.DECRYPTION_FAILED,
                    DECRYPTION_FAILED: nsIEnigmail.DECRYPTION_FAILED,
                    DECRYPTION_OKAY: nsIEnigmail.DECRYPTION_OKAY,
                    TRUST_UNDEFINED: nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_NEVER:     nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_MARGINAL:  nsIEnigmail.UNTRUSTED_IDENTITY,
                    TRUST_FULLY:     nsIEnigmail.TRUSTED_IDENTITY,
                    TRUST_ULTIMATE:  nsIEnigmail.TRUSTED_IDENTITY,
                    CARDCTRL:        nsIEnigmail.CARDCTRL,
                    SC_OP_FAILURE:   nsIEnigmail.SC_OP_FAILURE,
                    UNKNOWN_ALGO:    nsIEnigmail.UNKNOWN_ALGO,
                    SIG_CREATED:     nsIEnigmail.SIG_CREATED,
                    END_ENCRYPTION : nsIEnigmail.END_ENCRYPTION,
                    INV_SGNR:				 0x100000000
};

///////////////////////////////////////////////////////////////////////////////
// File read/write operations

const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";

const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";

const NS_RDONLY      = 0x01;
const NS_WRONLY      = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE    = 0x20;
const DEFAULT_FILE_PERMS = 0600;

const GET_BOOL = "GET_BOOL";
const GET_LINE = "GET_LINE";
const GET_HIDDEN = "GET_HIDDEN";

const BUTTON_POS_0           = 1;
const BUTTON_POS_1           = 1 << 8;
const BUTTON_POS_2           = 1 << 16;

const KEYTYPE_DSA = 1;
const KEYTYPE_RSA = 2;

const ENC_TYPE_MSG = 0;
const ENC_TYPE_ATTACH_BINARY = 1;
const ENC_TYPE_ATTACH_ASCII = 2;

const DUMMY_AGENT_INFO = "none";

var gMimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224", "md5" ];

var gKeyAlgorithms = [];

function getLocalFileApi() {
  if ("nsILocalFile" in Ci) {
    return Ci.nsILocalFile;
  }
  else
    return Ci.nsIFile;
}

function CreateFileStream(filePath, permissions) {

  //Ec.DEBUG_LOG("enigmail.js: CreateFileStream: file="+filePath+"\n");

  try {
    var localFile;
    if (typeof filePath == "string") {
      localFile = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(getLocalFileApi());
      initPath(localFile, filePath);
    }
    else {
      localFile = filePath.QueryInterface(getLocalFileApi());
    }

    if (localFile.exists()) {

      if (localFile.isDirectory() || !localFile.isWritable())
         throw Components.results.NS_ERROR_FAILURE;

      if (!permissions)
        permissions = localFile.permissions;
    }

    if (!permissions)
      permissions = DEFAULT_FILE_PERMS;

    var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;

    var fileStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);

    fileStream.init(localFile, flags, permissions, 0);

    return fileStream;

  } catch (ex) {
    Ec.ERROR_LOG("enigmail.js: CreateFileStream: Failed to create "+filePath+"\n");
    return null;
  }
}

function WriteFileContents(filePath, data, permissions) {

  Ec.DEBUG_LOG("enigmail.js: WriteFileContents: file="+filePath.toString()+"\n");

  try {
    var fileOutStream = CreateFileStream(filePath, permissions);

    if (data.length) {
      if (fileOutStream.write(data, data.length) != data.length)
        throw Components.results.NS_ERROR_FAILURE;

      fileOutStream.flush();
    }
    fileOutStream.close();

  } catch (ex) {
    Ec.ERROR_LOG("enigmail.js: WriteFileContents: Failed to write to "+filePath+"\n");
    return false;
  }

  return true;
}

// Read the contents of a file into a string

function EnigReadFile(filePath) {

// @filePath: nsIFile

  if (filePath.exists()) {

    var ioServ = Cc[NS_IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
    if (!ioServ)
      throw Components.results.NS_ERROR_FAILURE;

    var fileURI = ioServ.newFileURI(filePath);
    var fileChannel = ioServ.newChannel(fileURI.asciiSpec, null, null);

    var rawInStream = fileChannel.open();

    var scriptableInStream = Cc[NS_SCRIPTABLEINPUTSTREAM_CONTRACTID].createInstance(Ci.nsIScriptableInputStream);
    scriptableInStream.init(rawInStream);
    var available = scriptableInStream.available()
    var fileContents = scriptableInStream.read(available);
    scriptableInStream.close();
    return fileContents;
  }
  return "";
}


///////////////////////////////////////////////////////////////////////////////

// path initialization function
// uses persistentDescriptor in case that initWithPath fails
// (seems to happen frequently with UTF-8 characters in path names)
function initPath(localFileObj, pathStr) {
  localFileObj.initWithPath(pathStr);

  if (! localFileObj.exists()) {
    localFileObj.persistentDescriptor = pathStr;
  }
}


// return the useable path (for gpg) of a file object
function getFilePath (nsFileObj, creationMode) {
  if (creationMode == null) creationMode = NS_RDONLY;

  return nsFileObj.path;
}

// return the OS string from XUL runtime
function detectOS () {

  var xulAppinfo = Cc[NS_XPCOM_APPINFO].getService(Ci.nsIXULRuntime);
  return xulAppinfo.OS;

}


///////////////////////////////////////////////////////////////////////////////
// Utility functions
///////////////////////////////////////////////////////////////////////////////

function isAbsolutePath(filePath, isDosLike) {
  // Check if absolute path
  if (isDosLike) {
    return ((filePath.search(/^\w+:\\/) == 0) || (filePath.search(/^\\\\/) == 0));
  } else {
    return (filePath.search(/^\//) == 0);
  }
}

function ResolvePath(filePath, envPath, isDosLike) {
  Ec.DEBUG_LOG("enigmail.js: ResolvePath: filePath="+filePath+"\n");

  if (isAbsolutePath(filePath, isDosLike))
    return filePath;

  if (!envPath)
     return null;

  var pathDirs = envPath.split(isDosLike ? ";" : ":");

  for (var j=0; j<pathDirs.length; j++) {
     try {
        var pathDir = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(getLocalFileApi());

        initPath(pathDir, pathDirs[j]);

        if (pathDir.exists() && pathDir.isDirectory()) {
           pathDir.appendRelativePath(filePath);

           if (pathDir.exists()) {
              return pathDir;
           }
        }
     } catch (ex) {
     }
  }

  return null;
}



// get a Windows registry value (string)
// @ keyPath: the path of the registry (e.g. Software\\GNU\\GnuPG)
// @ keyName: the name of the key to get (e.g. InstallDir)
// @ rootKey: HKLM, HKCU, etc. (according to constants in nsIWindowsRegKey)
function getWinRegistryString(keyPath, keyName, rootKey) {
  var registry = Cc["@mozilla.org/windows-registry-key;1"].createInstance(Ci.nsIWindowsRegKey);

  var retval = "";
  try {
    registry.open(rootKey, keyPath, registry.ACCESS_READ);
    retval = registry.readStringValue(keyName);
    registry.close();
  }
  catch (ex) {}

  return retval;
}

function ExtractMessageId(uri) {
  var messageId = "";

  var matches = uri.match(/^enigmail:message\/(.+)/);

  if (matches && (matches.length > 1)) {
    messageId = matches[1];
  }

  return messageId;
}

///////////////////////////////////////////////////////////////////////////////
// Enigmail protocol handler
///////////////////////////////////////////////////////////////////////////////

function EnigmailProtocolHandler()
{
}

EnigmailProtocolHandler.prototype = {

  classDescription: "Enigmail Protocol Handler",
  classID:          NS_ENIGMAILPROTOCOLHANDLER_CID,
  contractID:       NS_ENIGMAILPROTOCOLHANDLER_CONTRACTID,
  scheme:           "enigmail",
  defaultPort:      -1,
  protocolFlags:    nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT |
                    nsIProtocolHandler.URI_LOADABLE_BY_ANYONE |
                    nsIProtocolHandler.URI_NORELATIVE |
                    nsIProtocolHandler.URI_NOAUTH |
                    nsIProtocolHandler.URI_OPENING_EXECUTES_SCRIPT,

  QueryInterface: XPCOMUtils.generateQI([nsIProtocolHandler]),

  newURI: function (aSpec, originCharset, aBaseURI) {
    Ec.DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newURI: aSpec='"+aSpec+"'\n");

    // cut of any parameters potentially added to the URI; these cannot be handled
    if (aSpec.substr(0,14) == "enigmail:dummy") aSpec = "enigmail:dummy";

    var uri = Cc[NS_SIMPLEURI_CONTRACTID].createInstance(Ci.nsIURI);
    uri.spec = aSpec;

    return uri;
  },

  newChannel: function (aURI) {
    Ec.DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newChannel: URI='"+aURI.spec+"'\n");

    var messageId = ExtractMessageId(aURI.spec);

    if (messageId) {
      // Handle enigmail:message/...

      if (!gEnigmailSvc)
        throw Components.results.NS_ERROR_FAILURE;

      var contentType, contentCharset, contentData;

      if (gEnigmailSvc._messageIdList[messageId]) {
        var messageUriObj = gEnigmailSvc._messageIdList[messageId];

        contentType    = messageUriObj.contentType;
        contentCharset = messageUriObj.contentCharset;
        contentData    = messageUriObj.contentData;

        Ec.DEBUG_LOG("enigmail.js: EnigmailProtocolHandler.newChannel: messageURL="+messageUriObj.originalUrl+", content length="+contentData.length+", "+contentType+", "+contentCharset+"\n");

        // do NOT delete the messageUriObj now from the list, this will be done once the message is unloaded (fix for bug 9730).

      } else {

        contentType = "text/plain";
        contentCharset = "";
        contentData = "Enigmail error: invalid URI "+aURI.spec;
      }

      var channel =Ec.newStringChannel(aURI, contentType, "UTF-8", contentData);

      return channel;
    }

    if (aURI.spec == aURI.scheme+":dummy") {
      // Dummy PKCS7 content (to access mimeEncryptedClass)
      channel = Ec.newStringChannel(aURI, "message/rfc822", "", gDummyPKCS7);
      return channel;
    }

    var winName, spec;
    if (aURI.spec == "about:"+aURI.scheme) {
      // About Enigmail
      winName = "about:"+enigmail;
      spec = "chrome://enigmail/content/enigmailAbout.xul";

    } else if (aURI.spec == aURI.scheme+":console") {
      // Display enigmail console messages
      winName = "enigmail:console";
      spec = "chrome://enigmail/content/enigmailConsole.xul";

    } else if (aURI.spec == aURI.scheme+":keygen") {
      // Display enigmail key generation console
      winName = "enigmail:keygen";
      spec = "chrome://enigmail/content/enigmailKeygen.xul";

    } else {
      // Display Enigmail about page
      winName = "about:enigmail";
      spec = "chrome://enigmail/content/enigmailAbout.xul";
    }

    var windowManager = Cc[WMEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);

    var winEnum=windowManager.getEnumerator(null);
    var recentWin=null;
    while (winEnum.hasMoreElements() && ! recentWin) {
      var thisWin = winEnum.getNext();
      if (thisWin.location.href==spec) {
        recentWin = thisWin;
      }
    }

    if (recentWin) {
      recentWin.focus();
    } else {
      var appShellSvc = Cc[ASS_CONTRACTID].getService(Ci.nsIAppShellService);
      var domWin = appShellSvc.hiddenDOMWindow;

      domWin.open(spec, "_blank", "chrome,menubar,toolbar,resizable");
    }

    throw Components.results.NS_ERROR_FAILURE;
  },

  allowPort: function (port, scheme) {
    // non-standard ports are not allowed
    return false;
  }
};


///////////////////////////////////////////////////////////////////////////////
// Enigmail encryption/decryption service
///////////////////////////////////////////////////////////////////////////////

// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email address
function EnigStripEmail(mailAddrs) {

  var qStart, qEnd;
  while ((qStart = mailAddrs.indexOf('"')) != -1) {
     qEnd = mailAddrs.indexOf('"', qStart+1);
     if (qEnd == -1) {
       Ec.ERROR_LOG("enigmail.js: EnigStripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
       mailAddrs=mailAddrs.replace(/\"/g, "");
       break;
     }

     mailAddrs = mailAddrs.substring(0,qStart) + mailAddrs.substring(qEnd+1);
  }

  // Eliminate all whitespace, just to be safe
  mailAddrs = mailAddrs.replace(/\s+/g,"");

  // Extract pure e-mail address list (stripping out angle brackets)
  mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*/g,"$1$2");

  return mailAddrs;
}

// Locates STRing in TEXT occurring only at the beginning of a line
function IndexOfArmorDelimiter(text, str, offset) {
  //Ec.DEBUG_LOG("enigmail.js: IndexOfArmorDelimiter: "+str+", "+offset+"\n");

  while (offset < text.length) {

    var loc = text.indexOf(str, offset);

    if ((loc < 1) || (text.charAt(loc-1) == "\n"))
      return loc;

    offset = loc + str.length;
  }

  return -1;
}


function Enigmail()
{
  Components.utils.import("resource://enigmail/enigmailCommon.jsm");
  Ec = EnigmailCommon;
}

Enigmail.prototype = {

  classDescription: "Enigmail",
  classID:  NS_ENIGMAIL_CID,
  contractID: NS_ENIGMAIL_CONTRACTID,

  initialized: false,
  initializationAttempted: false,
  initializationError: "",
  composeSecure: false,
  logFileStream: null,

  isUnix   : false,
  isWin32  : false,
  isMacOs  : false,
  isOs2    : false,
  isDosLike: false,

  prefBranch: null,
  keygenProcess: null,  // TODO: remove me
  keygenConsole: null,

  agentType: "",
  agentPath: "",
  agentVersion: "",
  gpgAgentProcess: null,
  userIdList: null,
  rulesList: null,
  gpgAgentInfo: {preStarted: false, envStr: ""},

  _messageIdList: {},
  _xpcom_factory: {
    createInstance: function (aOuter, iid) {
      // Enigmail is a service -> only instanciate once
      if (gEnigmailSvc == null) {
        gEnigmailSvc = new Enigmail();
      }
      return gEnigmailSvc;
    },
    lockFactory: function (lock) {}
  },
  QueryInterface: XPCOMUtils.generateQI([ nsIEnigmail, nsIObserver, nsISupports ]),


  observe: function (aSubject, aTopic, aData) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.observe: topic='"+aTopic+"' \n");

    if (aTopic == NS_XPCOM_SHUTDOWN_OBSERVER_ID) {
      // XPCOM shutdown
      this.finalize();

    }
    else {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.observe: no handler for '"+aTopic+"'\n");
    }
  },

  alertMsg: function (domWindow, mesg) {
    var promptService = Cc[NS_PROMPTSERVICE_CONTRACTID].getService(Ci.nsIPromptService);
    return promptService.alert(domWindow, Ec.getString("enigAlert"), mesg);
  },

  confirmMsg: function (domWindow, mesg, okLabel, cancelLabel) {
    var dummy={};
    var promptService = Cc[NS_PROMPTSERVICE_CONTRACTID].getService(Ci.nsIPromptService);

    var buttonTitles = 0;
    if (okLabel == null && cancelLabel == null) {
      buttonTitles = (promptService.BUTTON_TITLE_YES * ENIG_BUTTON_POS_0) +
                     (promptService.BUTTON_TITLE_NO * ENIG_BUTTON_POS_1);
    }
    else {
      if (okLabel != null) {
        buttonTitles += (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0);
      }
      else {
        buttonTitles += promptService.BUTTON_TITLE_OK * promptService.BUTTON_POS_1;
      }

      if (cancelLabel != null) {
        buttonTitles += (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_1);
      }
      else {
        buttonTitles += promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1;
      }
    }

    var buttonPressed = promptService.confirmEx(domWindow,
                          Ec.getString("enigConfirm"),
                          mesg,
                          buttonTitles,
                          okLabel, cancelLabel, null,
                          null, dummy);
    return (buttonPressed==0);
  },

  promptValue: function (domWindow, mesg, valueObj) {
    var promptService = Cc[NS_PROMPTSERVICE_CONTRACTID].getService(Ci.nsIPromptService);
    var checkObj = new Object();
    return promptService.prompt(domWindow, Ec.getString("enigPrompt"),
                                 mesg, valueObj, "", checkObj);
  },

  errorMsg: function (domWindow, mesg) {
    var promptService = Cc[NS_PROMPTSERVICE_CONTRACTID].getService(Ci.nsIPromptService);
    return promptService.alert(domWindow, Ec.getString("enigError"), mesg);
  },

  getLogDirectoryPrefix: function () {
    var logDirectory = "";
    try {
      logDirectory = this.prefBranch.getCharPref("logDirectory");
    } catch (ex) {
    }

    if (!logDirectory)
      return "";

    var dirPrefix = logDirectory + (this.isDosLike ? "\\" : "/");

    return dirPrefix;
  },


  finalize: function () {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.finalize:\n");
    if (!this.initialized) return;

    if (this.gpgAgentProcess != null) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.finalize: stopping gpg-agent PID="+this.gpgAgentProcess+"\n");
      try {
        var libName=subprocess.getPlatformValue(0);
        var libc = ctypes.open(libName);

        //int kill(pid_t pid, int sig);
        var kill = libc.declare("kill",
                              ctypes.default_abi,
                              ctypes.int,
                              ctypes.int32_t,
                              ctypes.int);

        kill(parseInt(this.gpgAgentProcess), 15);
      }
      catch (ex) {
        Ec.ERROR_LOG("enigmail.js: Enigmail.finalize ERROR: "+ex+"\n");
      }
    }

    if (this.logFileStream) {
      this.logFileStream.close();
      this.logFileStream = null;
    }

    gLogLevel = 3;
    this.initializationError = "";
    this.initializationAttempted = false;
    this.initialized = false;
  },


  mimeInitialized: function () {
    var enigMimeService = Cc[NS_ENIGMIMESERVICE_CONTRACTID].getService(Ci.nsIEnigMimeService);

    var value = enigMimeService.initialized;
    Ec.DEBUG_LOG("enigmail.js: Enigmail.mimeInitialized: "+value+"\n");
    return value;
  },

  initialize: function (domWindow, version, prefBranch) {
    this.initializationAttempted = true;

    this.prefBranch = prefBranch;

    Ec.DEBUG_LOG("enigmail.js: Enigmail.initialize: START\n");
    if (this.initialized) return;

    this.composeSecure = true;
    var ioServ = Cc[NS_IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);

    try {
      var httpHandler = ioServ.getProtocolHandler("http");
      httpHandler = httpHandler.QueryInterface(Ci.nsIHttpProtocolHandler);
    }
    catch (ex) {
      httpHandler = domWindow.navigator;
    }

    this.oscpu = httpHandler.oscpu;

    this.platform = httpHandler.platform;

    if (httpHandler.vendor) {
      this.vendor = httpHandler.vendor;
    } else {
      this.vendor = "Mozilla";
    }

    this.isUnix  = (this.platform.search(/X11/i) == 0);
    this.isWin32 = (this.platform.search(/Win/i) == 0);
    this.isOs2   = (this.platform.search(/OS\/2/i) == 0);
    this.isMacOs = (this.platform.search(/Mac/i) == 0);

    this.isDosLike = (this.isWin32 || this.isOs2);

    var prefix = this.getLogDirectoryPrefix();
    if (prefix) {
      gLogLevel = 5;
      this.logFileStream = CreateFileStream(prefix+"enigdbug.txt");
      Ec.DEBUG_LOG("enigmail.js: Logging debug output to "+prefix+"enigdbug.txt\n");
    }

    Ec.initialize(this, gLogLevel);
    this.version = version;

    Ec.DEBUG_LOG("enigmail.js: Enigmail version "+this.version+"\n");
    Ec.DEBUG_LOG("enigmail.js: OS/CPU="+this.oscpu+"\n");
    Ec.DEBUG_LOG("enigmail.js: Platform="+this.platform+"\n");
    Ec.DEBUG_LOG("enigmail.js: composeSecure="+this.composeSecure+"\n");

    var environment;
    try {
      environment = Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);

    } catch (ex) {
      this.initializationError = Ec.getString("enigmimeNotAvail");
      Ec.ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
      Ec.DEBUG_LOG("enigmail.js: Enigmail.initialize: exception="+ex.toString()+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    this.environment = environment;

    var nspr_log_modules = environment.get("NSPR_LOG_MODULES");
    var matches = nspr_log_modules.match(/enigmail:(\d+)/);

    if (matches && (matches.length > 1)) {
      gLogLevel = matches[1];
      Ec.WARNING_LOG("enigmail.js: Enigmail: gLogLevel="+gLogLevel+"\n");
    }

    subprocess.registerLogHandler(function(txt) { Ec.ERROR_LOG("subprocess.jsm: "+txt) });

    matches = nspr_log_modules.match(/subprocess:(\d+)/);
    if (matches && (matches.length > 1)) {
      if (matches[1] > 2) subprocess.registerDebugHandler(function(txt) { Ec.DEBUG_LOG("subprocess.jsm: "+txt) });
    }

    matches = nspr_log_modules.match(/nsPipeTransport:(\d+)/);
    if (matches && (matches.length > 1)) {
      if (matches[1] > 2) PipeTransport.registerDebugHandler(function(txt) { Ec.DEBUG_LOG("pipeTransport.jsm: "+txt+"\n") });
    }


    // Initialize global environment variables list
    var passEnv = [ "GNUPGHOME", "GPGDIR", "ETC",
                    "ALLUSERSPROFILE", "APPDATA", "BEGINLIBPATH",
                    "COMMONPROGRAMFILES", "COMSPEC", "DISPLAY",
                    "ENIGMAIL_PASS_ENV", "ENDLIBPATH",
                    "HOME", "HOMEDRIVE", "HOMEPATH",
                    "LANG", "LANGUAGE", "LC_ALL", "LC_COLLATE",  "LC_CTYPE",
                    "LC_MESSAGES",  "LC_MONETARY", "LC_NUMERIC", "LC_TIME",
                    "LOCPATH", "LOGNAME", "LD_LIBRARY_PATH", "MOZILLA_FIVE_HOME",
                    "NLSPATH", "PATH", "PATHEXT", "PROGRAMFILES", "PWD",
                    "SHELL", "SYSTEMDRIVE", "SYSTEMROOT",
                    "TEMP", "TMP", "TMPDIR", "TZ", "TZDIR", "UNIXROOT",
                    "USER", "USERPROFILE", "WINDIR" ];

    var passList = this.environment.get("ENIGMAIL_PASS_ENV");
    if (passList) {
      var passNames = passList.split(":");
      for (var k=0; k<passNames.length; k++)
        passEnv.push(passNames[k]);
    }

    Ec.envList = [];
    for (var j=0; j<passEnv.length; j++) {
      var envName = passEnv[j];
      var envValue = this.environment.get(envName);
      if (envValue)
         Ec.envList.push(envName+"="+envValue);
    }

    Ec.DEBUG_LOG("enigmail.js: Enigmail.initialize: Ec.envList = "+Ec.envList+"\n");

    try {
      EnigmailConsole.write("Initializing Enigmail service ...\n");

    } catch (ex) {
      this.initializationError = Ec.getString("enigmimeNotAvail");
      Ec.ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
      Ec.DEBUG_LOG("enigmail.js: Enigmail.initialize: exception="+ex.toString()+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    this.setAgentPath(domWindow);

    this.detectGpgAgent(domWindow);

    if (this.useGpgAgent() && (! this.isDosLike)) {
      if (this.gpgAgentInfo.envStr != DUMMY_AGENT_INFO)
        Ec.envList.push("GPG_AGENT_INFO="+this.gpgAgentInfo.envStr);
    }




    // Register to observe XPCOM shutdown
    var obsServ = Cc[NS_OBSERVERSERVICE_CONTRACTID].getService();
    obsServ = obsServ.QueryInterface(Ci.nsIObserverService);

    obsServ.addObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID, false);

    Ec.stillActive();
    this.initialized = true;

    Ec.DEBUG_LOG("enigmail.js: Enigmail.initialize: END\n");
  },

  useGpgAgent: function() {
    var useAgent = false;

    try {
      if (this.isDosLike && this.agentVersion < "2.0") {
        useAgent = false;
      }
      else {
        // gpg version >= 2.0.16 launches gpg-agent automatically
        if (this.agentVersion >= "2.0.16") {
          useAgent = true;
          Ec.DEBUG_LOG("enigmail.js: Setting useAgent to "+useAgent+" for gpg2 >= 2.0.16\n");
        }
        else {
          useAgent = (this.gpgAgentInfo.envStr.length>0 || this.prefBranch.getBoolPref("useGpgAgent"));
        }
      }
    }
    catch (ex) {}
    return useAgent;
  },


  reinitialize: function () {
    this.initialized = false;
    this.initializationAttempted = true;

    EnigmailConsole.write("Reinitializing Enigmail service ...\n");
    this.setAgentPath();
    this.initialized = true;
  },


  determineGpgHomeDir: function () {

    var homeDir = "";

    homeDir = this.environment.get("GNUPGHOME");

    if (! homeDir && this.isWin32) {
      homeDir=getWinRegistryString("Software\\GNU\\GNUPG", "HomeDir", nsIWindowsRegKey.ROOT_KEY_CURRENT_USER);

      if (! homeDir) {
        homeDir = this.environment.get("USERPROFILE");

        if (! homeDir) {
          homeDir = this.environment.get("SystemRoot");
        }

        if (homeDir) homeDir += "\\Application Data\\GnuPG";
      }

      if (! homeDir) homeDir = "C:\\gnupg";
    }

    if (! homeDir) homeDir = this.environment.get("HOME")+"/.gnupg";

    return homeDir;
  },


  setAgentPath: function (domWindow) {
    var agentPath = "";
    try {
      agentPath = this.prefBranch.getCharPref("agentPath");
    } catch (ex) {}

    var agentType = "gpg";
    var agentName = this.isDosLike ? agentType+".exe" : agentType;

    if (agentPath) {
      // Locate GnuPG executable

      // Append default .exe extension for DOS-Like systems, if needed
      if (this.isDosLike && (agentPath.search(/\.\w+$/) < 0))
        agentPath += ".exe";

      try {
        var pathDir = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(getLocalFileApi());

        if (! isAbsolutePath(agentPath, this.isDosLike)) {
          // path relative to Mozilla installation dir
          var ds = Cc[DIR_SERV_CONTRACTID].getService();
          var dsprops = ds.QueryInterface(Ci.nsIProperties);
          pathDir = dsprops.get("CurProcD", getLocalFileApi());

          var dirs=agentPath.split(RegExp(this.isDosLike ? "\\\\" : "/"));
          for (var i=0; i< dirs.length; i++) {
            if (dirs[i]!=".") {
              pathDir.append(dirs[i]);
            }
          }
          pathDir.normalize();
        }
        else {
          // absolute path
          initPath(pathDir, agentPath);
        }
        if (! (pathDir.isFile() /* && pathDir.isExecutable()*/))
          throw Components.results.NS_ERROR_FAILURE;
        agentPath = pathDir.QueryInterface(Ci.nsIFile);

      } catch (ex) {
        this.initializationError = Ec.getString("gpgNotFound", [ agentPath ]);
        Ec.ERROR_LOG("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
        throw Components.results.NS_ERROR_FAILURE;
      }

    } else {
      // Resolve relative path using PATH environment variable
      var envPath = this.environment.get("PATH");

      agentPath = ResolvePath(agentName, envPath, this.isDosLike);

      if (!agentPath && this.isDosLike) {
        // DOS-like systems: search for GPG in c:\gnupg, c:\gnupg\bin, d:\gnupg, d:\gnupg\bin
        var gpgPath = "c:\\gnupg;c:\\gnupg\\bin;d:\\gnupg;d:\\gnupg\\bin";
        agentPath = ResolvePath(agentName, gpgPath, this.isDosLike);
      }

      if ((! agentPath) && this.isWin32) {
        // Look up in Windows Registry
        try {
          gpgPath = getWinRegistryString("Software\\GNU\\GNUPG", "Install Directory", nsIWindowsRegKey.ROOT_KEY_LOCAL_MACHINE);
          agentPath = ResolvePath(agentName, gpgPath, this.isDosLike)
        }
        catch (ex) {}
      }

      if (!agentPath && !this.isDosLike) {
        // Unix-like systems: check /usr/bin and /usr/local/bin
        gpgPath = "/usr/bin:/usr/local/bin";
        agentPath = ResolvePath(agentName, gpgPath, this.isDosLike)
      }

      if (!agentPath) {
        this.initializationError = Ec.getString("gpgNotInPath");
        Ec.ERROR_LOG("enigmail.js: Enigmail: Error - "+this.initializationError+"\n");
        throw Components.results.NS_ERROR_FAILURE;
      }
      agentPath = agentPath.QueryInterface(Ci.nsIFile);
    }

    Ec.CONSOLE_LOG("EnigmailAgentPath="+Ec.getFilePathDesc(agentPath)+"\n\n");

    this.agentType = agentType;
    this.agentPath = agentPath;

    var command = agentPath;
    var args = [];
    if (agentType == "gpg") {
       args = [ "--version", "--version", "--batch", "--no-tty", "--charset", "utf-8", "--display-charset", "utf-8" ];
    }

    var exitCode = -1;
    var outStr = "";
    Ec.DEBUG_LOG("enigmail.js: Enigmail.setAgentPath: calling subprocess with '"+command.path+"'\n");

    var proc = {
      command:     command,
      arguments:   args,
      environment: Ec.envList,
      charset: null,
      done: function(result) {
        exitCode = result.exitCode;
        outStr = result.stdout;
      },
      mergeStderr: true
    };

    try {
      subprocess.call(proc).wait()
    } catch (ex) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.setAgentPath: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }

    Ec.CONSOLE_LOG("enigmail> "+Ec.printCmdLine(command, args)+"\n");

    if (exitCode != 0) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.setAgentPath: gpg failed with '"+outStr+"'\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    Ec.CONSOLE_LOG(outStr+"\n");

    // detection for Gpg4Win wrapper
    if (outStr.search(/^gpgwrap.*;/) == 0) {
      var outLines = outStr.split(/[\n\r]+/);
      var firstLine = outLines[0];
      outLines.splice(0,1);
      outStr = outLines.join("\n");
      agentPath = firstLine.replace(/^.*;[ \t]*/, "")

      Ec.CONSOLE_LOG("gpg4win-gpgwrapper detected; EnigmailAgentPath="+agentPath+"\n\n");
    }

    var versionParts = outStr.replace(/[\r\n].*/g,"").replace(/ *\(gpg4win.*\)/i, "").split(/ /);
    var gpgVersion = versionParts[versionParts.length-1]

    Ec.DEBUG_LOG("enigmail.js: detected GnuPG version '"+gpgVersion+"'\n");
    this.agentVersion = gpgVersion;

    // check GnuPG version number
    var evalVersion = this.agentVersion.match(/^\d+\.\d+/)
    if (evalVersion && evalVersion[0]< "1.4") {
      if (domWindow) this.alertMsg(domWindow, Ec.getString("oldGpgVersion", [ gpgVersion ]));
      throw Components.results.NS_ERROR_FAILURE;
    }
  },

  detectGpgAgent: function (domWindow) {
    Ec.DEBUG_LOG("enigmail.js: detectGpgAgent\n");

    function extractAgentInfo(fullStr) {
      if (fullStr) {
        fullStr = fullStr.replace(/^.*\=/,"");
        fullStr = fullStr.replace(/^\;.*$/,"");
        fullStr = fullStr.replace(/[\n\r]*/g,"");
        return fullStr;
      }
      else
        return "";
    }


    function resolveAgentPath(fileName) {
      var filePath = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(getLocalFileApi());

      if (gEnigmailSvc.isDosLike) {
        fileName += ".exe";
      }

      filePath = gEnigmailSvc.agentPath.clone();

      if (filePath) filePath = filePath.parent;
      if (filePath) {
        filePath.append(fileName);
        if (filePath.exists()) {
          filePath.normalize();
          return filePath;
        }
      }

      var foundPath = ResolvePath(fileName, gEnigmailSvc.environment.get("PATH"), gEnigmailSvc.isDosLike)
      if (foundPath != null) { foundPath.normalize(); }
      return foundPath;
    }

    var gpgAgentInfo = this.environment.get("GPG_AGENT_INFO");
    if (gpgAgentInfo && gpgAgentInfo.length>0) {
      Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: GPG_AGENT_INFO variable available\n");
      // env. variable suggests running gpg-agent
      this.gpgAgentInfo.preStarted = true;
      this.gpgAgentInfo.envStr = gpgAgentInfo;
    }
    else {
      Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: no GPG_AGENT_INFO variable set\n");
      this.gpgAgentInfo.preStarted = false;

      if (this.agentVersion >= "2.0") {
        if (this.agentVersion >= "2.0.16") {
          Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: gpg 2.0.16 or newer - not starting agent\n");
        }
        else {
          var command = null;
          var gpgConnectAgent = resolveAgentPath("gpg-connect-agent");

          var outStr = "";
          var errorStr = "";
          var exitCode = -1;

          if (gpgConnectAgent && gpgConnectAgent.isExecutable()) {
            // try to connect to a running gpg-agent

            Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: gpg-connect-agent is executable\n");

            this.gpgAgentInfo.envStr = DUMMY_AGENT_INFO;

            command = gpgConnectAgent.QueryInterface(Ci.nsIFile);

            Ec.CONSOLE_LOG("enigmail> "+command.path+"\n");

            try {
              subprocess.call({
                command: command,
                environment: Ec.envList,
                stdin: "/echo OK\n",
                charset: null,
                done: function(result) {
                  Ec.DEBUG_LOG("detectGpgAgent detection terminated with "+result.exitCode+"\n");
                  exitCode = result.exitCode;
                  outStr = result.stdout;
                  errorStr = result.stderr;
                  if (result.stdout.substr(0,2) == "OK") exitCode = 0;
                },
                mergeStderr: false,
              }).wait()
            } catch (ex) {
              Ec.ERROR_LOG("enigmail.js: detectGpgAgent: "+command.path+" failed\n");
              exitCode = -1;
            }

            if (exitCode == 0) {
              Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: found running gpg-agent\n");
              return;
            }
            else {
              Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: no running gpg-agent. Output='"+outStr+"' error text='"+errorStr+"'\n");
            }

          }

          // and finally try to start gpg-agent
          var args = [];
          var commandFile = resolveAgentPath("gpg-agent");
          var agentProcess = null;

          if ((! commandFile) || (! commandFile.exists())) {
            commandFile = resolveAgentPath("gpg-agent2");
          }

          if (commandFile  && commandFile.exists()) {
            command = commandFile.QueryInterface(Ci.nsIFile);
          }

          if (command == null) {
            Ec.ERROR_LOG("enigmail.js: detectGpgAgent: gpg-agent not found\n");
            this.alertMsg(domWindow, Ec.getString("gpgAgentNotStarted", [ this.agentVersion ]));
            throw Components.results.NS_ERROR_FAILURE;
          }
        }

        if ((! this.isDosLike) && (this.agentVersion < "2.0.16" )) {
          args = [ "--sh", "--no-use-standard-socket",
                  "--daemon",
                  "--default-cache-ttl", (Ec.getMaxIdleMinutes()*60).toString(),
                  "--max-cache-ttl", "999999" ];  // ca. 11 days

          try {
            var p = subprocess.call({
              command: command,
              charset: null,
              arguments: args,
              environment: Ec.envList,
              stdin: null,
              done: function(result) {
                Ec.DEBUG_LOG("detectGpgAgent start terminated with "+result.exitCode+"\n");
                exitCode = result.exitCode;
                outStr = result.stdout;
              },
              mergeStderr: true,
            });
            p.wait();
          } catch (ex) {
            Ec.ERROR_LOG("enigmail.js: detectGpgAgent: "+command.path+" failed\n");
            exitCode = -1;
          }

          if (exitCode == 0) {
            this.gpgAgentInfo.envStr = extractAgentInfo(outStr);
            Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: started -> "+outStr+"\n");
            this.gpgAgentProcess = this.gpgAgentInfo.envStr.split(":")[1];
          }
          else {
            Ec.ERROR_LOG("enigmail.js: detectGpgAgent: gpg-agent output: "+outStr+"\n");
            this.alertMsg(domWindow, Ec.getString("gpgAgentNotStarted", [ this.agentVersion ]));
            throw Components.results.NS_ERROR_FAILURE;
          }
        }
        else {
          this.gpgAgentInfo.envStr = DUMMY_AGENT_INFO;
          var envFile = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(getLocalFileApi());
          initPath(envFile, this.determineGpgHomeDir());
          envFile.append("gpg-agent.conf");

          var data="default-cache-ttl " + (Ec.getMaxIdleMinutes()*60)+"\n";
          data += "max-cache-ttl 999999";
          if (! envFile.exists()) {
            try {
              var flags = 0x02 | 0x08 | 0x20;
              var fileOutStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
              fileOutStream.init(envFile, flags, 0600, 0);
              fileOutStream.write(data, data.length);
              fileOutStream.flush();
              fileOutStream.close();
            }
            catch (ex) {} // ignore file write errors
          }
        }
      }
      else {
        Ec.DEBUG_LOG("enigmail.js: detectGpgAgent - gpg 1.x found\n");
      }
    }
    Ec.DEBUG_LOG("enigmail.js: detectGpgAgent: GPG_AGENT_INFO='"+this.gpgAgentInfo.envStr+"'\n");
  },


  simpleExecCmd: function (command, args, exitCodeObj, errorMsgObj) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.simpleExecCmd: command = "+command+" "+args.join(" ")+"\n");

    var envList = [];
    envList = envList.concat(Ec.envList);

    var prefix = this.getLogDirectoryPrefix();
    if (prefix && (gLogLevel >= 4)) {

      WriteFileContents(prefix+"enigcmd.txt", Ec.printCmdLine(command, args)+"\n");
      WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");

      Ec.DEBUG_LOG("enigmail.js: Enigmail.simpleExecCmd: copied command line/env/input to files "+prefix+"enigcmd.txt/enigenv.txt/eniginp.txt\n");
    }

    var outputData = "";
    var errOutput  = "";

    Ec.CONSOLE_LOG("enigmail> "+Ec.printCmdLine(command, args)+"\n");

    try {
      subprocess.call({
        command: command,
        arguments: args,
        charset: null,
        environment: envList,
        done: function(result) {
          exitCodeObj.value = result.exitCode;
          outputData = result.stdout;
          errOutput = result.stderr;
        },
        mergeStderr: false,
      }).wait()
    } catch (ex) {
      Ec.ERROR_LOG("enigmail.js: simpleExecCmd: "+command.path+" failed\n");
      exitCodeObj.value = -1;
    }

    if (errOutput)
       errorMsgObj.value  = errOutput;

    if (prefix && (gLogLevel >= 4)) {
      WriteFileContents(prefix+"enigout.txt", outputData);
      WriteFileContents(prefix+"enigerr.txt", errOutput);
      Ec.DEBUG_LOG("enigmail.js: Enigmail.simpleExecCmd: copied command out/err data to files "+prefix+"enigout.txt/enigerr.txt\n");
    }

    Ec.DEBUG_LOG("enigmail.js: Enigmail.simpleExecCmd: exitCode = "+exitCodeObj.value+"\n");
    Ec.DEBUG_LOG("enigmail.js: Enigmail.simpleExecCmd: errOutput = "+errOutput+"\n");

    Ec.stillActive();

    return outputData;
  },

  execCmd: function (command, args, passphrase, input, exitCodeObj, statusFlagsObj,
            statusMsgObj, errorMsgObj) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.execCmd: subprocess = '"+command.path+"'\n");

    if ((typeof input) != "string") input = "";
    var prependPassphrase = ((typeof passphrase) == "string");

    var envList = [];
    envList = envList.concat(Ec.envList);

    var preInput;

    if (prependPassphrase) {
      preInput = passphrase;
      input = "\n" + input;

    } else {
      preInput = "";
    }

    var prefix = this.getLogDirectoryPrefix();
    if (prefix && (gLogLevel >= 4)) {

      if (prependPassphrase) {
        // Obscure passphrase
        WriteFileContents(prefix+"eniginp.txt", "<passphrase>"+input);
      } else {
        WriteFileContents(prefix+"eniginp.txt", input);
      }

      WriteFileContents(prefix+"enigcmd.txt", Ec.printCmdLine(command, args)+"\n");
      WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");

      Ec.DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command line/env/input to files "+prefix+"enigcmd.txt/enigenv.txt/eniginp.txt\n");
    }

    var blockSeparationObj = new Object();

    Ec.CONSOLE_LOG("enigmail> "+Ec.printCmdLine(command, args)+"\n");

    var proc = {
      command:     command,
      arguments:   args,
      environment: envList,
      charset: null,
      stdin: preInput + input,
      done: function(result) {
        this.exitCode = result.exitCode;
        this.resultData = result.stdout;
        this.errorData = result.stderr;
      },
      mergeStderr: false,
      resultData: "",
      errorData: "",
      exitCode: -1
    };

    try {
      subprocess.call(proc).wait()
      exitCodeObj.value = proc.exitCode;

    } catch (ex) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.execCmd: subprocess.call failed with '"+ex.toString()+"'\n");
      exitCodeObj.value = -1;
    }

    var outputData = "";
    var errOutput  = "";

    if (proc.resultData) outputData = proc.resultData;
    if (proc.errorData) errOutput  = proc.errorData;

    if (prefix && (gLogLevel >= 4)) {
      WriteFileContents(prefix+"enigout.txt", outputData);
      WriteFileContents(prefix+"enigerr.txt", errOutput);
      Ec.DEBUG_LOG("enigmail.js: Enigmail.execCmd: copied command out/err data to files "+prefix+"enigout.txt/enigerr.txt\n");
    }

    Ec.DEBUG_LOG("enigmail.js: Enigmail.execCmd: exitCode = "+exitCodeObj.value+"\n");
    Ec.DEBUG_LOG("enigmail.js: Enigmail.execCmd: errOutput = "+errOutput+"\n");


    errorMsgObj.value = Ec.parseErrorOutput(errOutput, statusFlagsObj, statusMsgObj, blockSeparationObj);
    exitCodeObj.value = Ec.fixExitCode(proc.exitCode, statusFlagsObj.value);

    if (blockSeparationObj.value.indexOf(" ") > 0) {
      exitCodeObj.value = 2;
    }

    Ec.CONSOLE_LOG(errorMsgObj.value+"\n");

    Ec.stillActive();

    return outputData;
  },

  execStart: function (command, args, needPassphrase, domWindow, prompter, listener,
            statusFlagsObj) {
    Ec.WRITE_LOG("enigmail.js: Enigmail.execStart: command = "+Ec.printCmdLine(command, args)+", needPassphrase="+needPassphrase+", domWindow="+domWindow+", prompter="+prompter+", listener="+listener+"\n");

    statusFlagsObj.value = 0;

    var envList = [];
    envList = envList.concat(Ec.envList);

    var passphrase = null;
    var useAgentObj = {value: false};

    if (needPassphrase) {
      args = args.concat(Ec.passwdCommand());

      var passwdObj = new Object();

      if (!Ec.getPassphrase(domWindow, passwdObj, useAgentObj, 0)) {
         Ec.ERROR_LOG("enigmail.js: Enigmail.execStart: Error - no passphrase supplied\n");

         statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
         return null;
      }

      passphrase = passwdObj.value;
    }

    var prefix = this.getLogDirectoryPrefix();
    if (prefix && (gLogLevel >= 4)) {

      WriteFileContents(prefix+"enigcmd.txt", Ec.printCmdLine(command, args)+"\n");
      WriteFileContents(prefix+"enigenv.txt", envList.join(",")+"\n");

      Ec.DEBUG_LOG("enigmail.js: Enigmail.execStart: copied command line/env to files "+prefix+"enigcmd.txt/enigenv.txt\n");
    }

    Ec.CONSOLE_LOG("enigmail> "+Ec.printCmdLine(command, args)+"\n");

    var pipetrans = PipeTransport.createInstance();

    pipetrans = pipetrans.QueryInterface(Ci.nsIPipeTransport);
    Ec.DEBUG_LOG("enigmail.js: Enigmail.execStart: pipetrans = " + pipetrans + "\n");

    try {
      var ipcBuffer = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
      ipcBuffer.open(ERROR_BUFFER_SIZE, false);

      var mergeStderr = false;
      pipetrans.init(command);
      pipetrans.openPipe(args, args.length, envList, envList.length,
                            0, "", mergeStderr,
                            ipcBuffer);

      if (listener) {
        pipetrans.asyncRead(listener, null, 0, -1, 0);
      }

      if (needPassphrase) {
        // Write to child STDIN
        // (ignore errors, because child may have exited already, closing STDIN)
        try {
          if (Ec.requirePassword()) {
             pipetrans.writeSync(passphrase, passphrase.length);
             pipetrans.writeSync("\n", 1);
          }
        } catch (ex) {}
      }

      return pipetrans;

    } catch (ex) {
      Ec.CONSOLE_LOG("enigmail.js: Enigmail.execStart: Error - Failed to start PipeTransport\n");
      Ec.ERROR_LOG(ex.toString());
      return null;
    }
  },


  execEnd: function (pipeTransport, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj, blockSeparationObj) {

    Ec.WRITE_LOG("enigmail.js: Enigmail.execEnd: \n");

    // Extract command line
    try {
      var request = pipeTransport.QueryInterface(Ci.nsIRequest);

      cmdLineObj.value = request.name;
    } catch (ex) {
      cmdLineObj.value = "unknown-command";
    }

    // Extract exit code and error output from pipeTransport
    var exitCode = pipeTransport.exitValue;

    var errListener = pipeTransport.stderrConsole.QueryInterface(Ci.nsIIPCBuffer);

    var outLength = new Object();
    var errOutput = errListener.getByteData(outLength);

    // Terminate pipeTransport
    errListener.shutdown();

    pipeTransport.terminate();

    var prefix = this.getLogDirectoryPrefix();
    if (prefix && (gLogLevel >= 4)) {
      WriteFileContents(prefix+"enigerr.txt", errOutput);
      Ec.DEBUG_LOG("enigmail.js: Enigmail.execEnd: copied command err output to file "+prefix+"enigerr.txt\n");
    }

    Ec.DEBUG_LOG("enigmail.js: Enigmail.execEnd: exitCode = "+exitCode+"\n");
    Ec.DEBUG_LOG("enigmail.js: Enigmail.execEnd: errOutput = "+errOutput+"\n");


    errorMsgObj.value = Ec.parseErrorOutput(errOutput, statusFlagsObj, statusMsgObj, blockSeparationObj);

    if (errOutput.search(/jpeg image of size \d+/)>-1) {
      statusFlagsObj.value |= nsIEnigmail.PHOTO_AVAILABLE;
    }
    if (blockSeparationObj && blockSeparationObj.value.indexOf(" ") > 0) {
      exitCode = 2;
    }

    Ec.CONSOLE_LOG(Ec.convertFromUnicode(errorMsgObj.value)+"\n");

    Ec.stillActive();

    return exitCode;
  },


  stripWhitespace: function(sendFlags) {
    var stripThem=false;
    if ((sendFlags & nsIEnigmail.SEND_SIGNED) &&
        (!(sendFlags & nsIEnigmail.SEND_ENCRYPTED))) {
      if (this.agentVersion >= "1.4.0" && this.agentVersion < "1.4.1") {
        stripThem = true;
      }
    }

    return stripThem;
  },

  encryptMessage: function (parent, uiFlags, hashAlgorithm, plainText, fromMailAddr, toMailAddr, bccMailAddr,
            sendFlags, exitCodeObj, statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: "+plainText.length+" bytes from "+fromMailAddr+" to "+toMailAddr+" ("+sendFlags+")\n");

    exitCodeObj.value    = -1;
    statusFlagsObj.value = 0;
    errorMsgObj.value    = "";

    var hashAlgo = gMimeHashAlgorithms[this.prefBranch.getIntPref("mimeHashAlgorithm")];

    if (hashAlgo == null) {
      hashAlgo = hashAlgorithm;
    }

    if (!plainText) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: NO ENCRYPTION!\n");
      exitCodeObj.value = 0;
      return plainText;
    }

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessage: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
    var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;

    if (encryptMsg) {
      // First convert all linebreaks to newlines
      plainText = plainText.replace(/\r\n/g, "\n");
      plainText = plainText.replace(/\r/g,   "\n");

      // Using platform-specific linebreaks confuses some windows mail clients,
      // so we convert everything to windows like good old PGP worked anyway.
      plainText = plainText.replace(/\n/g, "\r\n");
    }

    var startErrorMsgObj = new Object();

    var ipcBuffer = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
    var bufferSize = ((plainText.length + 20000)/1024).toFixed(0)*1024;
    if (MSG_BUFFER_SIZE > bufferSize)
      bufferSize=MSG_BUFFER_SIZE;

    ipcBuffer.open(bufferSize, false);

    var pipeTrans = this.encryptMessageStart(parent, null, uiFlags,
                                             fromMailAddr, toMailAddr, bccMailAddr,
                                             hashAlgo, sendFlags, ipcBuffer,
                                             statusFlagsObj, startErrorMsgObj);

    if (!pipeTrans) {
      errorMsgObj.value = startErrorMsgObj.value;

      return "";
    }

    // Write to child STDIN
    // (ignore errors, because child may have exited already, closing STDIN)
    try {
      pipeTrans.write(plainText, plainText.length);
    } catch (ex) {}

    // Wait for child STDOUT to close
    pipeTrans.join();

    var cipherText = ipcBuffer.getData();
    ipcBuffer.shutdown();

    var exitCode = this.encryptMessageEnd(parent, null, uiFlags, sendFlags,
                                          plainText.length, pipeTrans,
                                          statusFlagsObj, errorMsgObj);

    exitCodeObj.value = exitCode;

    if ((exitCodeObj.value == 0) && !cipherText)
      exitCodeObj.value = -1;

    if (exitCodeObj.value == 0) {
      // Normal return
      return cipherText;
    }

    // Error processing
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessage: command execution exit code: "+exitCodeObj.value+"\n");

    return "";
  },


  encryptMessageEnd: function (parent, prompter, uiFlags, sendFlags, outputLen, pipeTransport,
            statusFlagsObj, errorMsgObj)
  {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessageEnd: uiFlags="+uiFlags+", sendFlags="+Ec.bytesToHex(Ec.pack(sendFlags,4))+", outputLen="+outputLen+", pipeTransport="+pipeTransport+"\n");

    var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;
    var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
    var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;

    statusFlagsObj.value = 0;
    errorMsgObj.value    = "";

    if (!this.initialized) {
       Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessageEnd: not yet initialized\n");
       errorMsgObj.value = Ec.getString("notInit");
       return -1;
    }

    // Terminate job and parse error output
    var statusMsgObj   = new Object();
    var cmdLineObj     = new Object();
    var cmdErrorMsgObj = new Object();

    var exitCode = this.execEnd(pipeTransport, statusFlagsObj, statusMsgObj, cmdLineObj, cmdErrorMsgObj);
    var statusMsg = statusMsgObj.value;
    exitCode = Ec.fixExitCode(exitCode, statusFlagsObj.value);
    if ((exitCode == 0) && !outputLen) {
      exitCode = -1;
    }

    if (exitCode != 0 && (signMsg || encryptMsg)) {
      // GnuPG might return a non-zero exit code, even though the message was correctly
      // signed or encryped -> try to fix the exit code

      var correctedExitCode = 0;
      if (signMsg) {
        if (! (statusFlagsObj.value & nsIEnigmail.SIG_CREATED)) correctedExitCode = exitCode;
      }
      if (encryptMsg) {
        if (! (statusFlagsObj.value & nsIEnigmail.END_ENCRYPTION)) correctedExitCode = exitCode;
      }
      exitCode = correctedExitCode;
    }

    if (exitCode == 0) {
      // Normal return
      errorMsgObj.value = cmdErrorMsgObj.value;
      return 0;
    }

    // Error processing
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessageEnd: command execution exit code: "+exitCode+"\n");

    if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
      // "Unremember" passphrase on error return
      Ec.clearCachedPassphrase();
    }

    if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
      errorMsgObj.value = Ec.getString("badPhrase");
    }
    else if (statusFlagsObj.value & nsIEnigmail.INVALID_RECIPIENT) {
      errorMsgObj.value = statusMsg;
      cmdErrorMsgObj.value = null;
    }
    else if (statusFlagsObj.value & nsIEnigmail.DISPLAY_MESSAGE) {
      errorMsgObj.value = statusMsg;

    }
    else {
      errorMsgObj.value = Ec.getString("badCommand");
    }

    if (cmdErrorMsgObj.value) {
      errorMsgObj.value += "\n\n" + this.agentType + " "+Ec.getString("cmdLine");
      errorMsgObj.value += "\n" + cmdLineObj.value;
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }

    if (pgpMime && errorMsgObj.value) {
      if (prompter)
        prompter.alert(Ec.getString("enigAlert"), errorMsgObj.value);
      else
        this.alertMsg(parent, errorMsgObj.value);
    }

    return exitCode;
  },


  getEncryptCommand: function (fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, isAscii, errorMsgObj) {
    try {
      fromMailAddr = EnigStripEmail(fromMailAddr);
      toMailAddr = EnigStripEmail(toMailAddr);
      bccMailAddr = EnigStripEmail(bccMailAddr);

    } catch (ex) {
      errorMsgObj.value = Ec.getString("invalidEmail");
      return null;
    }

    var defaultSend = sendFlags & nsIEnigmail.SEND_DEFAULT;
    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;
    var encryptMsg  = sendFlags & nsIEnigmail.SEND_ENCRYPTED;
    var usePgpMime =  sendFlags & nsIEnigmail.SEND_PGP_MIME;

    var useDefaultComment = false;
    try {
       useDefaultComment = this.prefBranch.getBoolPref("useDefaultComment")
    } catch(ex) { }

    var hushMailSupport = false;
    try {
       hushMailSupport = this.prefBranch.getBoolPref("hushMailSupport")
    } catch(ex) { }

    var detachedSig = (usePgpMime || (sendFlags & nsIEnigmail.SEND_ATTACHMENT)) && signMsg && !encryptMsg;

    var toAddrList = toMailAddr.split(/\s*,\s*/);
    var bccAddrList = bccMailAddr.split(/\s*,\s*/);
    var k;

    var encryptArgs = Ec.getAgentArgs(true);

    if (!useDefaultComment)
      encryptArgs = encryptArgs.concat(["--comment", GPG_COMMENT_OPT.replace(/\%s/, this.vendor)]);

    var angledFromMailAddr = ((fromMailAddr.search(/^0x/) == 0) || hushMailSupport)
                           ? fromMailAddr : "<" + fromMailAddr + ">";
    angledFromMailAddr = angledFromMailAddr.replace(/([\"\'\`])/g, "\\$1");

    if (signMsg && hashAlgorithm) {
      encryptArgs = encryptArgs.concat(["--digest-algo", hashAlgorithm]);
    }

    if (encryptMsg) {
      switch (isAscii) {
      case ENC_TYPE_MSG:
        encryptArgs.push("-a");
        encryptArgs.push("-t");
        break;
      case ENC_TYPE_ATTACH_ASCII:
        encryptArgs.push("-a");
      }

      encryptArgs.push("--encrypt");

      if (signMsg)
        encryptArgs.push("--sign");

      if (sendFlags & nsIEnigmail.SEND_ALWAYS_TRUST) {
        if (this.agentVersion >= "1.4") {
          encryptArgs.push("--trust-model");
          encryptArgs.push("always");
        }
        else {
          encryptArgs.push("--always-trust");
        }
      }
      if ((sendFlags & nsIEnigmail.SEND_ENCRYPT_TO_SELF) && fromMailAddr)
        encryptArgs = encryptArgs.concat(["--encrypt-to", angledFromMailAddr]);

      for (k=0; k<toAddrList.length; k++) {
        toAddrList[k] = toAddrList[k].replace(/\'/g, "\\'");
        if (toAddrList[k].length > 0) {
           encryptArgs.push("-r");
           if (toAddrList[k].search(/^GROUP:/) == 0) {
             // groups from gpg.conf file
             encryptArgs.push(toAddrList[k].substr(6));
           }
           else {
             encryptArgs.push((hushMailSupport || (toAddrList[k].search(/^0x/) == 0)) ? toAddrList[k]
                            :"<" + toAddrList[k] + ">");
           }
        }
      }

      for (k=0; k<bccAddrList.length; k++) {
        bccAddrList[k] = bccAddrList[k].replace(/\'/g, "\\'");
        if (bccAddrList[k].length > 0) {
          encryptArgs.push("--hidden-recipient");
          encryptArgs.push((hushMailSupport || (bccAddrList[k].search(/^0x/) == 0)) ? bccAddrList[k]
                    :"<" + bccAddrList[k] + ">");
        }
      }

    } else if (detachedSig) {
      encryptArgs = encryptArgs.concat(["-s", "-b"]);

      switch (isAscii) {
      case ENC_TYPE_MSG:
        encryptArgs = encryptArgs.concat(["-a", "-t"]);
        break;
      case ENC_TYPE_ATTACH_ASCII:
        encryptArgs.push("-a");
      }

    } else if (signMsg) {
      encryptArgs = encryptArgs.concat(["-t", "--clearsign"]);
    }

    if (fromMailAddr) {
      encryptArgs = encryptArgs.concat(["-u", angledFromMailAddr]);
    }

    return encryptArgs;
  },

  determineHashAlgorithm: function (prompter, uiFlags, fromMailAddr, hashAlgoObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.determineHashAlgorithm: from "+fromMailAddr+"\n");

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj    = new Object();

    var sendFlags = nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_SIGNED;

    var hashAlgo = gMimeHashAlgorithms[this.prefBranch.getIntPref("mimeHashAlgorithm")];

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.determineHashAlgorithm: Enigmail not initialized\n")
      this.alertMsg(null, Ec.getString("notInit"));
      return 2;
    }

    if (typeof(gKeyAlgorithms[fromMailAddr]) != "string") {
      // hash algorithm not yet known
      var passwdObj   = new Object();
      var useAgentObj = new Object();
      // Get the passphrase and remember it for the next 2 subsequent calls to gpg
      if (!Ec.getPassphrase(null, passwdObj, useAgentObj, 2)) {
        Ec.ERROR_LOG("enigmail.js: Enigmail.determineHashAlgorithm: Error - no passphrase supplied\n");

        return 3;
      }

      var testUiFlags = nsIEnigmail.UI_TEST;

      var ipcBuffer = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
      var bufferSize = 10240;

      ipcBuffer.open(bufferSize, false);

      var pipeTrans = this.encryptMessageStart(null, prompter, testUiFlags,
                                               fromMailAddr, "", "",
                                               hashAlgo, sendFlags, ipcBuffer,
                                               statusFlagsObj, errorMsgObj);
      if (!pipeTrans) {
        return 1;
      }

      var plainText = "Dummy Test";

      // Write to child STDIN
      // (ignore errors, because child may have exited already, closing STDIN)
      try {
        pipeTrans.write(plainText, plainText.length);
      } catch (ex) {}

      // Wait for child STDOUT to close
      pipeTrans.join();

      var msgText = ipcBuffer.getData();
      ipcBuffer.shutdown();

      var exitCode = this.encryptMessageEnd(null, prompter, testUiFlags, sendFlags,
                                            plainText.length, pipeTrans,
                                            statusFlagsObj, errorMsgObj);

      if ((exitCode == 0) && !msgText) exitCode = 1;
      // if (exitCode > 0) exitCode = -exitCode;

      if (exitCode != 0) {
        // Abormal return
        if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
          // "Unremember" passphrase on error return
          Ec.clearCachedPassphrase();
          errorMsgObj.value = Ec.getString("badPhrase");
        }
        this.alertMsg(null, errorMsgObj.value);
        return exitCode;
      }

      var hashAlgorithm = "md5"; // default as defined in RFC 4880, section 7

      var m = msgText.match(/^(Hash: )(.*)$/m);
      if (m && (m.length > 2) && (m[1] == "Hash: ")) {
        hashAlgorithm = m[2].toLowerCase();
      }
      else
        Ec.DEBUG_LOG("enigmail.js: Enigmail.determineHashAlgorithm: no hashAlgorithm specified - using MD5\n");

      for (var i=1; i < gMimeHashAlgorithms.length; i++) {
        if (gMimeHashAlgorithms[i] == hashAlgorithm) {
          Ec.DEBUG_LOG("enigmail.js: Enigmail.determineHashAlgorithm: found hashAlgorithm "+hashAlgorithm+"\n");
          gKeyAlgorithms[fromMailAddr] = hashAlgorithm;
          hashAlgoObj.value = hashAlgorithm;
          return 0;
        }
      }

      Ec.ERROR_LOG("enigmail.js: Enigmail.determineHashAlgorithm: no hashAlgorithm found\n");
      return 2;
    }
    else {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.determineHashAlgorithm: hashAlgorithm "+gKeyAlgorithms[fromMailAddr]+" is cached\n");
      hashAlgoObj.value = gKeyAlgorithms[fromMailAddr];
    }

    return 0;
  },


  encryptMessageStart: function (parent, prompter, uiFlags, fromMailAddr, toMailAddr, bccMailAddr,
            hashAlgorithm, sendFlags, listener, statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessageStart: prompter="+prompter+", uiFlags="+uiFlags+", from "+fromMailAddr+" to "+toMailAddr+", hashAlgorithm="+hashAlgorithm+" ("+Ec.bytesToHex(Ec.pack(sendFlags,4))+")\n");

    var pgpMime = uiFlags & nsIEnigmail.UI_PGP_MIME;

    errorMsgObj.value = "";

    if (!sendFlags) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptMessageStart: NO ENCRYPTION!\n");
      errorMsgObj.value = Ec.getString("notRequired");
      return null;
    }

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessageStart: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return null;
    }

    if (this.keygenProcess) {
      errorMsgObj.value = Ec.getString("notComplete");
      return null;
    }

    var encryptArgs = this.getEncryptCommand(fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, ENC_TYPE_MSG, errorMsgObj);
    if (! encryptArgs)
      return null;

    var signMsg     = sendFlags & nsIEnigmail.SEND_SIGNED;

    var pipetrans = this.execStart(this.agentPath, encryptArgs, signMsg, parent, prompter,
                                   listener, statusFlagsObj);

    if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.encryptMessageStart: Error - no passphrase supplied\n");

      errorMsgObj.value = "";
    }

    if (pgpMime && errorMsgObj.value) {
      if (prompter)
        prompter.alert(Ec.getString("enigAlert"), errorMsgObj.value);
      else
        this.alertMsg(parent, errorMsgObj.value);
    }

    return pipetrans;
  },


  // Locates offsets bracketing PGP armored block in text,
  // starting from given offset, and returns block type string.
  // beginIndex = offset of first character of block
  // endIndex = offset of last character of block (newline)
  // If block is not found, the null string is returned;

  locateArmoredBlock: function (text, offset, indentStr, beginIndexObj, endIndexObj,
            indentStrObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.locateArmoredBlock: "+offset+", '"+indentStr+"'\n");

    beginIndexObj.value = -1;
    endIndexObj.value = -1;

    var beginIndex = IndexOfArmorDelimiter(text, indentStr+"-----BEGIN PGP ", offset);

    if (beginIndex == -1) {
      var blockStart=text.indexOf("-----BEGIN PGP ")
      if (blockStart>=0) {
        var indentStart=text.search(/\n.*\-\-\-\-\-BEGIN PGP /)+1;
        indentStrObj.value=text.substring(indentStart, blockStart);
        indentStr=indentStrObj.value;
        beginIndex = IndexOfArmorDelimiter(text, indentStr+"-----BEGIN PGP ", offset);
      }
    }

    if (beginIndex == -1)
      return "";

    // Locate newline at end of armor header
    offset = text.indexOf("\n", beginIndex);

    if (offset == -1)
      return "";

    var endIndex = IndexOfArmorDelimiter(text, indentStr+"-----END PGP ", offset);

    if (endIndex == -1)
      return "";

    // Locate newline at end of PGP block
    endIndex = text.indexOf("\n", endIndex);

    if (endIndex == -1) {
      // No terminating newline
      endIndex = text.length - 1;
    }

    var blockHeader = text.substr(beginIndex, offset-beginIndex+1);

    var blockRegex = new RegExp("^" + indentStr +
                                "-----BEGIN PGP (.*)-----\\s*\\r?\\n");

    var matches = blockHeader.match(blockRegex);

    var blockType = "";
    if (matches && (matches.length > 1)) {
        blockType = matches[1];
        Ec.DEBUG_LOG("enigmail.js: Enigmail.locateArmoredBlock: blockType="+blockType+"\n");
    }

    if (blockType == "UNVERIFIED MESSAGE") {
      // Skip any unverified message block
      return this.locateArmoredBlock(text, endIndex+1, indentStr,
                                     beginIndexObj, endIndexObj, indentStrObj);
    }

    beginIndexObj.value = beginIndex;
    endIndexObj.value = endIndex;

    return blockType;
  },


  extractSignaturePart: function (signatureBlock, part) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.extractSignaturePart: part="+part+"\n");

    // Search for blank line
    var offset = signatureBlock.search(/\n\s*\r?\n/);
    if (offset == -1)
      return "";

    offset = signatureBlock.indexOf("\n", offset+1);
    if (offset == -1)
      return "";

    var beginIndex = signatureBlock.indexOf("-----BEGIN PGP SIGNATURE-----",
                                            offset+1);
    if (beginIndex == -1)
      return "";

    if (part == nsIEnigmail.SIGNATURE_TEXT) {
      var signedText = signatureBlock.substr(offset+1, beginIndex-offset-1);

      // Unescape leading dashes
      signedText = signedText.replace(/^- -/, "-");
      signedText = signedText.replace(/\n- -/g, "\n-");
      signedText = signedText.replace(/\r- -/g, "\r-");

      return signedText;
    }

    // Locate newline at end of armor header
    offset = signatureBlock.indexOf("\n", beginIndex);

    if (offset == -1)
      return "";

    var endIndex = signatureBlock.indexOf("-----END PGP SIGNATURE-----", offset);
    if (endIndex == -1)
      return "";

    var signBlock = signatureBlock.substr(offset, endIndex-offset);

    // Search for blank line
    var armorIndex = signBlock.search(/\n\s*\r?\n/);
    if (armorIndex == -1)
      return "";

    if (part == nsIEnigmail.SIGNATURE_HEADERS) {
      return signBlock.substr(1, armorIndex);
    }

    armorIndex = signBlock.indexOf("\n", armorIndex+1);
    if (armorIndex == -1)
      return "";

    if (part == nsIEnigmail.SIGNATURE_ARMOR) {
      var armorData = signBlock.substr(armorIndex, endIndex-armorIndex);
      armorData = armorData.replace(/\s*/g, "");
      return armorData;
    }

    return "";
  },


  decryptMessage: function (parent, uiFlags, cipherText, signatureObj, exitCodeObj,
            statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj,
            blockSeparationObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: "+cipherText.length+" bytes, "+uiFlags+"\n");

    if (! cipherText)
      return "";

    var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;
    var allowImport = uiFlags & nsIEnigmail.UI_ALLOW_KEY_IMPORT;
    var unverifiedEncryptedOK = uiFlags & nsIEnigmail.UI_UNVERIFIED_ENC_OK;
    var oldSignature = signatureObj.value;

    Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: oldSignature="+oldSignature+"\n");

    signatureObj.value   = "";
    exitCodeObj.value    = -1;
    statusFlagsObj.value = 0;
    keyIdObj.value       = "";
    userIdObj.value      = "";
    errorMsgObj.value    = "";

    var beginIndexObj = new Object();
    var endIndexObj = new Object();
    var indentStrObj = new Object();
    var blockType = this.locateArmoredBlock(cipherText, 0, "",
                                            beginIndexObj, endIndexObj, indentStrObj);

    if (!blockType || blockType == "SIGNATURE") {
      errorMsgObj.value = Ec.getString("noPGPblock");
      statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;
      return "";
    }

    var publicKey = (blockType == "PUBLIC KEY BLOCK");

    var verifyOnly = (blockType == "SIGNED MESSAGE");

    var pgpBlock = cipherText.substr(beginIndexObj.value,
                            endIndexObj.value - beginIndexObj.value + 1);

    if (indentStrObj.value) {
      RegExp.multiline = true;
      var indentRegexp = new RegExp("^"+indentStrObj.value, "g");
      pgpBlock = pgpBlock.replace(indentRegexp, "");
      if (indentStrObj.value.substr(-1) == " ") {
         var indentRegexpStr = "^"+indentStrObj.value.replace(/ $/, "$");
         indentRegexp = new RegExp(indentRegexpStr, "g");
         pgpBlock = pgpBlock.replace(indentRegexp, "");
      }
      RegExp.multiline = false;
    }

    // HACK to better support messages from Outlook: if there are empty lines, drop them
    if (pgpBlock.search(/MESSAGE-----\r?\n\r?\nVersion/) >=0) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: apply Outlook empty line workaround\n");
      pgpBlock = pgpBlock.replace( /\r?\n\r?\n/g, "\n" );
    }

    var head = cipherText.substr(0, beginIndexObj.value);
    var tail = cipherText.substr(endIndexObj.value+1,
                                 cipherText.length - endIndexObj.value - 1);

    if (publicKey) {
      if (!allowImport) {
        errorMsgObj.value = Ec.getString("decryptToImport");
        statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;
        statusFlagsObj.value |= nsIEnigmail.INLINE_KEY;

        return "";
      }

      // Import public key
      var importFlags = nsIEnigmail.UI_INTERACTIVE;
      exitCodeObj.value = this.importKey(parent, importFlags, pgpBlock, "",
                                         errorMsgObj);
      if (exitCodeObj.value == 0) {
        statusFlagsObj.value |= nsIEnigmail.IMPORTED_KEY;
      }
      return "";
    }

    var newSignature = "";

    if (verifyOnly) {
      newSignature = this.extractSignaturePart(pgpBlock,
                                                nsIEnigmail.SIGNATURE_ARMOR);

      if (oldSignature && (newSignature != oldSignature)) {
        Ec.ERROR_LOG("enigmail.js: Enigmail.decryptMessage: Error - signature mismatch "+newSignature+"\n");
        errorMsgObj.value = Ec.getString("sigMismatch");
        statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

        return "";
      }
    }

    var noOutput = false;
    var startErrorMsgObj = new Object();

    var readBytes = MSG_BUFFER_SIZE;
    if (verifyOnly && pgpBlock.length > MSG_BUFFER_SIZE) {
      readBytes = ((pgpBlock.length+1500)/1024).toFixed(0)*1024;
    }
    if (readBytes > MAX_MSG_BUFFER_SIZE) {
      errorMsgObj.value = Ec.getString("messageSizeError");
      statusFlagsObj.value |= nsIEnigmail.OVERFLOWED;
      exitCodeObj.value = 1;
      return "";
    }

    const maxTries = 2;
    var tryCount = 0;
    while (tryCount < maxTries) {
      tryCount++;

      var ipcBuffer = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
      ipcBuffer.open(readBytes, false);

      var pipeTrans = this.decryptMessageStart(parent, null, verifyOnly, noOutput,
                                            ipcBuffer, statusFlagsObj, startErrorMsgObj);

      if (!pipeTrans) {
        errorMsgObj.value = startErrorMsgObj.value;
        statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

        return "";
      }

      // Write to child STDIN
      // (ignore errors, because child may have exited already, closing STDIN)
      try {
        pipeTrans.write(pgpBlock, pgpBlock.length);
      } catch (ex) {}

      // Wait for child STDOUT to close
      pipeTrans.join();

      var overflowed = ipcBuffer.overflowed;
      var plainText = ipcBuffer.getData();
      if (ipcBuffer.overflowed && plainText.length < ipcBuffer.totalBytes) {
        readBytes = ((ipcBuffer.totalBytes+1500)/1024).toFixed(0)*1024;
        Ec.WRITE_LOG("enigmail.js: Enigmail.decryptMessage: decrypted text too big for standard buffer, retrying with buffer size="+readBytes+"\n");
      }
      else {
        tryCount = maxTries;
      }

      ipcBuffer.shutdown();
      ipcBuffer = null; // make sure the object gets freed

      var exitCode = this.decryptMessageEnd(uiFlags, plainText.length, pipeTrans,
                                          verifyOnly, noOutput,
                                          statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj,
                                          errorMsgObj, blockSeparationObj);
      exitCodeObj.value = exitCode;
    }

    if ((head.search(/\S/) >= 0) ||
        (tail.search(/\S/) >= 0)) {
      statusFlagsObj.value |= nsIEnigmail.PARTIALLY_PGP;
    }


    if (exitCodeObj.value == 0) {
      // Normal return

      var doubleDashSeparator = false;
      try {
         doubleDashSeparator = this.prefBranch.getBoolPref("doubleDashSeparator")
      } catch(ex) { }

      if (doubleDashSeparator && (plainText.search(/(\r|\n)-- +(\r|\n)/) < 0) ) {
        // Workaround for MsgCompose stripping trailing spaces from sig separator
        plainText = plainText.replace(/(\r|\n)--(\r|\n)/, "$1-- $2");
      }

      statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

      if (verifyOnly && indentStrObj.value) {
        RegExp.multiline = true;
        plainText = plainText.replace(/^/g, indentStrObj.value)
        RegExp.multiline = false;
      }
      return plainText;
    }

    var pubKeyId = keyIdObj.value;

    if (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE) {
      if (verifyOnly && indentStrObj.value) {
        // Probably replied message that could not be verified
        errorMsgObj.value = Ec.getString("unverifiedReply")+"\n\n"+errorMsgObj.value;
        return "";
      }

      // Return bad signature (for checking later)
      signatureObj.value = newSignature;

    } else if (pubKeyId &&
               (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE)) {

      var innerKeyBlock;
      if (verifyOnly) {
        // Search for indented public key block in signed message
        var innerBlockType = this.locateArmoredBlock(pgpBlock, 0, "- ",
                                                     beginIndexObj, endIndexObj,
                                                     indentStrObj);

        if (innerBlockType == "PUBLIC KEY BLOCK") {

          innerKeyBlock = pgpBlock.substr(beginIndexObj.value,
                                     endIndexObj.value - beginIndexObj.value + 1);

          innerKeyBlock = innerKeyBlock.replace(/- -----/g, "-----");

          statusFlagsObj.value |= nsIEnigmail.INLINE_KEY;
          Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessage: innerKeyBlock found\n");
        }
      }

      if (allowImport) {

        var importedKey = false;

        if (innerKeyBlock) {
          var importErrorMsgObj = new Object();
          var importFlags2 = nsIEnigmail.UI_INTERACTIVE;
          var exitStatus = this.importKey(parent, importFlags2, innerKeyBlock,
                                          pubKeyId, importErrorMsgObj);

          importedKey = (exitStatus == 0);

          if (exitStatus > 0) {
            this.alertMsg(parent, Ec.getString("cantImport")+importErrorMsgObj.value);
          }
        }

        if (importedKey) {
          // Recursive call; note that nsIEnigmail.UI_ALLOW_KEY_IMPORT is unset
          // to break the recursion
          var uiFlagsDeep = interactive ? nsIEnigmail.UI_INTERACTIVE : 0;
          signatureObj.value = "";
          return this.decryptMessage(parent, uiFlagsDeep, pgpBlock,
                                      signatureObj, exitCodeObj, statusFlagsObj,
                                      keyIdObj, userIdObj, sigDetailsObj, errorMsgObj);
        }

      }

      if (plainText && !unverifiedEncryptedOK) {
        // Append original PGP block to unverified message
        plainText = "-----BEGIN PGP UNVERIFIED MESSAGE-----\r\n" + plainText +
                    "-----END PGP UNVERIFIED MESSAGE-----\r\n\r\n" + pgpBlock;
      }

    }

    return verifyOnly ? "" : plainText;
  },


  decryptMessageStart: function (parent, prompter, verifyOnly, noOutput,
            listener, statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessageStart: prompter="+prompter+", verifyOnly="+verifyOnly+", noOutput="+noOutput+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.decryptMessageStart: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return null;
    }

    if (this.keygenProcess) {
      errorMsgObj.value = Ec.getString("notComplete");
      return null;
    }

    var args = Ec.getAgentArgs(true);

    var keyserver = this.prefBranch.getCharPref("autoKeyRetrieve");
    if (keyserver != "") {
      args.push("--keyserver-options");
      var keySrvArgs="auto-key-retrieve";
      var srvProxy = Ec.getHttpProxy(keyserver);
      if (srvProxy) {
        keySrvArgs += ",http-proxy="+srvProxy;
      }
      args.push(keySrvArgs);
      args.push("--keyserver");
      args.push(keyserver);
    }

    if (noOutput) {
      args.push("--verify");

    } else {
      args.push("--decrypt");
    }

    var pipetrans = this.execStart(this.agentPath, args, !verifyOnly, parent, prompter,
                                   listener, statusFlagsObj);

    if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.decryptMessageStart: Error - no passphrase supplied\n");

      errorMsgObj.value = Ec.getString("noPassphrase");
      return null;
    }

    return pipetrans;
  },


  decryptMessageEnd: function (uiFlags, outputLen, pipeTransport, verifyOnly, noOutput,
            statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj, blockSeparationObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessageEnd: uiFlags="+uiFlags+", outputLen="+outputLen+", pipeTransport="+pipeTransport+", verifyOnly="+verifyOnly+", noOutput="+noOutput+"\n");

    var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;
    var pgpMime     = uiFlags & nsIEnigmail.UI_PGP_MIME;
    var allowImport = uiFlags & nsIEnigmail.UI_ALLOW_KEY_IMPORT;
    var unverifiedEncryptedOK = uiFlags & nsIEnigmail.UI_UNVERIFIED_ENC_OK;
    var j;

    statusFlagsObj.value = 0;
    errorMsgObj.value    = "";
    blockSeparationObj.value = "";

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.decryptMessageEnd: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return -1;
    }

    // Terminate job and parse error output
    var statusMsgObj   = new Object();
    var cmdLineObj     = new Object();
    var cmdErrorMsgObj = new Object();

    var exitCode = this.execEnd(pipeTransport, statusFlagsObj, statusMsgObj, cmdLineObj, cmdErrorMsgObj, blockSeparationObj);

    if (pgpMime) {
      statusFlagsObj.value |= verifyOnly ? nsIEnigmail.PGP_MIME_SIGNED
                                         : nsIEnigmail.PGP_MIME_ENCRYPTED;
    }

    var statusMsg = statusMsgObj.value;
    exitCode = Ec.fixExitCode(exitCode, statusFlagsObj.value);
    if ((exitCode == 0) && !noOutput && !outputLen &&
        ((statusFlagsObj.value & (gStatusFlags.DECRYPTION_OKAY | gStatusFlags.GOODSIG)) == 0)) {
      exitCode = -1;
    }

    if (exitCode == 0) {
      // Normal return
      var errLines, goodSignPat, badSignPat, keyExpPat, revKeyPat, validSigPat;

      if (statusMsg) {
          errLines = statusMsg.split(/\r?\n/);

          goodSignPat =   /GOODSIG (\w{16}) (.*)$/i;
          badSignPat  =    /BADSIG (\w{16}) (.*)$/i;
          keyExpPat   = /EXPKEYSIG (\w{16}) (.*)$/i
          revKeyPat   = /REVKEYSIG (\w{16}) (.*)$/i;
          validSigPat =  /VALIDSIG (\w+) (.*) (\d+) (.*)/i;

      } else {
          errLines = cmdErrorMsgObj.value.split(/\r?\n/);

          goodSignPat = /Good signature from (user )?"(.*)"\.?/i;
          badSignPat  =  /BAD signature from (user )?"(.*)"\.?/i;
          keyExpPat   = /This key has expired/i;
          revKeyPat   = /This key has been revoked/i;
          validSigPat = /dummy-not-used/i;
      }

      errorMsgObj.value = "";

      var matches;

      var signed = false;
      var goodSignature;

      var userId = "";
      var keyId = "";
      var sigDetails = "";

      for (j=0; j<errLines.length; j++) {
        matches = errLines[j].match(badSignPat);

        if (matches && (matches.length > 2)) {
          signed = true;
          goodSignature = false;
          userId = matches[2];
          keyId = matches[1];
          break;
        }

        matches = errLines[j].match(revKeyPat);

        if (matches && (matches.length > 2)) {
          signed = true;
          goodSignature = true;
          userId = matches[2];
          keyId = matches[1];
          break;
        }

        matches = errLines[j].match(goodSignPat);

        if (matches && (matches.length > 2)) {
          signed = true;
          goodSignature = true;
          userId = matches[2];
          keyId = matches[1];
          break;
        }

        matches = errLines[j].match(keyExpPat);

        if (matches && (matches.length > 2)) {
          signed = true;
          goodSignature = true;
          userId = matches[2];
          keyId = matches[1];

          break;
        }
      }

      if (goodSignature) {
        for (var j=0; j<errLines.length; j++) {
          matches = errLines[j].match(validSigPat);

          if (matches && (matches.length > 4))
            keyId = matches[4].substr(-16); // in case of several subkeys refer to the main key ID

          if (matches && (matches.length > 2)) {
            sigDetails = errLines[j].substr(9);
            break;
          }
        }
      }

      try {
        if (userId && keyId && this.prefBranch.getBoolPref("displaySecondaryUid")) {
          let uids = this.getKeyDetails(keyId, true);
          if (uids) {
            userId = uids;
          }
        }
      }
      catch (ex) {}

      if (userId) {
        userId = Ec.convertToUnicode(userId, "UTF-8");
      }

      userIdObj.value = userId;
      keyIdObj.value = keyId;
      sigDetailsObj.value = sigDetails;

      if (signed) {
        var trustPrefix = "";

        if (statusFlagsObj.value & nsIEnigmail.UNTRUSTED_IDENTITY) {
          trustPrefix += Ec.getString("prefUntrusted")+" ";
        }

        if (statusFlagsObj.value & nsIEnigmail.REVOKED_KEY) {
          trustPrefix += Ec.getString("prefRevoked")+" ";
        }

        if (statusFlagsObj.value & nsIEnigmail.EXPIRED_KEY_SIGNATURE) {
          trustPrefix += Ec.getString("prefExpiredKey")+" ";

        } else if (statusFlagsObj.value & nsIEnigmail.EXPIRED_SIGNATURE) {
          trustPrefix += Ec.getString("prefExpired")+" ";
        }

        if (goodSignature) {
          errorMsgObj.value = trustPrefix + Ec.getString("prefGood", [userId]) /* + ", " +
                Ec.getString("keyId") + " 0x" + keyId.substring(8,16); */
        } else {
          errorMsgObj.value = trustPrefix + Ec.getString("prefBad", [userId]) /*+ ", " +
                Ec.getString("keyId") + " 0x" + keyId.substring(8,16); */
          if (!exitCode)
            exitCode = 1;
        }
      }

      if (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE) {
        keyIdObj.value = this.extractPubkey(statusMsg)
      }

      return exitCode;
    }


    if (statusFlagsObj.value & nsIEnigmail.BAD_PASSPHRASE) {
      // "Unremember" passphrase on decryption failure
      Ec.clearCachedPassphrase();
    }

    var pubKeyId;

    if (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE) {
      // Unverified signature
      keyIdObj.value = this.extractPubkey(statusMsg);

      if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_OKAY) {
        exitCode=0;
      }

    }

    if (exitCode != 0) {
      // Error processing
      Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptMessageEnd: command execution exit code: "+exitCode+"\n");
    }

    if (cmdErrorMsgObj.value) {
      errorMsgObj.value = this.agentType + " " + Ec.getString("cmdLine");
      errorMsgObj.value += "\n" + cmdLineObj.value;
      errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
    }

    return exitCode;
  },


  // Extract public key from Status Message
  extractPubkey: function (statusMsg) {
    var keyId = null;
    var matchb = statusMsg.match(/(^|\n)NO_PUBKEY (\w{8})(\w{8})/);

    if (matchb && (matchb.length > 3)) {
      Ec.DEBUG_LOG("enigmail.js: Enigmail.extractPubkey: NO_PUBKEY 0x"+matchb[3]+"\n");
      keyId = matchb[2]+matchb[3];
    }

    return keyId;
  },

  extractKey: function (parent, exportFlags, userId, outputFile, exitCodeObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.extractKey: "+userId+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.extractKey: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    var uidList=userId.split(/[ ,\t]+/);

    var args = Ec.getAgentArgs(true);
    args = args.concat(["-a", "--export"]);
    args = args.concat(uidList);

    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();

    var keyBlock = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if ((exitCodeObj.value == 0) && !keyBlock)
      exitCodeObj.value = -1;

    if (exitCodeObj.value != 0) {
      errorMsgObj.value = Ec.getString("failKeyExtract");

      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + command;
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }

    if (exportFlags & nsIEnigmail.EXTRACT_SECRET_KEY) {
      args = Ec.getAgentArgs(true);
      args = args.concat(["-a", "--export-secret-keys"]);
      args = args.concat(uidList);

      var secKeyBlock = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

      if ((exitCodeObj.value == 0) && !secKeyBlock)
        exitCodeObj.value = -1;

      if (exitCodeObj.value != 0) {
        errorMsgObj.value = Ec.getString("failKeyExtract");

        if (cmdErrorMsgObj.value) {
          errorMsgObj.value += "\n" + command;
          errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
        }

        return "";
      }

      if (keyBlock.substr(-1,1).search(/[\r\n]/)<0) keyBlock += "\n"
      keyBlock+=secKeyBlock;
    }

    if (outputFile) {
      if (! WriteFileContents(outputFile, keyBlock, DEFAULT_FILE_PERMS)) {
        exitCodeObj.value = -1;
        errorMsgObj.value = Ec.getString("fileWriteFailed", [ outputFile ]);
      }
      return "";
    }
    return keyBlock;
  },


  // ExitCode == 0  => success
  // ExitCode > 0   => error
  // ExitCode == -1 => Cancelled by user
  importKey: function (parent, uiFlags, msgText, keyId, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.importKey: id="+keyId+", "+uiFlags+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.importKey: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return 1;
    }

    var beginIndexObj = new Object();
    var endIndexObj   = new Object();
    var indentStrObj   = new Object();
    var blockType = this.locateArmoredBlock(msgText, 0, "",
                                            beginIndexObj, endIndexObj,
                                            indentStrObj);

    if (!blockType) {
      errorMsgObj.value = Ec.getString("noPGPblock");
      return 1;
    }

    if (blockType != "PUBLIC KEY BLOCK") {
      errorMsgObj.value = Ec.getString("notFirstBlock");
      return 1;
    }

    var pgpBlock = msgText.substr(beginIndexObj.value,
                                  endIndexObj.value - beginIndexObj.value + 1);

    var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;

    if (interactive) {
      if (!this.confirmMsg(parent, Ec.getString("importKeyConfirm"), Ec.getString("keyMan.button.import"))) {
        errorMsgObj.value = Ec.getString("failCancel");
        return -1;
      }
    }

    var args = Ec.getAgentArgs(true);
    args.push("--import");

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();

    var output = this.execCmd(this.agentPath, args, null, pgpBlock,
                        exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

    var statusMsg = statusMsgObj.value;

    var pubKeyId;

    if (exitCodeObj.value == 0) {
      // Normal return
      this.invalidateUserIdList();
      if (statusMsg && (statusMsg.search("IMPORTED ") > -1)) {
        var matches = statusMsg.match(/(^|\n)IMPORTED (\w{8})(\w{8})/);

        if (matches && (matches.length > 3)) {
          pubKeyId = "0x" + matches[3];
          Ec.DEBUG_LOG("enigmail.js: Enigmail.importKey: IMPORTED "+pubKeyId+"\n");
        }
      }
    }

    return exitCodeObj.value;
  },

  getEscapedFilename: function (fileNameStr) {
    return Ec.getEscapedFilename(fileNameStr);
  },

  importKeyFromFile: function (parent, inputFile, errorMsgObj, importedKeysObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.importKeyFromFile: fileName="+inputFile.path+"\n");
    importedKeysObj.value="";

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.importKeyFromFile: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return 1;
    }

    var fileName=this.getEscapedFilename(getFilePath(inputFile.QueryInterface(getLocalFileApi())));

    var args = Ec.getAgentArgs(true);
    args.push("--import");
    args.push(fileName);

    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();
    var exitCodeObj    = new Object();

    var output = this.execCmd(this.agentPath, args, null, "",
                        exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

    var statusMsg = statusMsgObj.value;

    var keyList = new Array();

    if (exitCodeObj.value == 0) {
      // Normal return
      this.invalidateUserIdList();

      var statusLines = statusMsg.split(/\r?\n/);

      // Discard last null string, if any

      for (var j=0; j<statusLines.length; j++) {
        var matches = statusLines[j].match(/IMPORT_OK ([0-9]+) (\w+)/);
        if (matches && (matches.length > 2)) {
          if (typeof (keyList[matches[2]]) != "undefined") {
            keyList[matches[2]] |= new Number(matches[1]);
          }
          else
            keyList[matches[2]] = new Number(matches[1]);

          Ec.DEBUG_LOG("enigmail.js: Enigmail.importKey: imported "+matches[2]+":"+matches[1]+"\n");
        }
      }

      for (j in keyList) {
        importedKeysObj.value += j+":"+keyList[j]+";";
      }
    }

    return exitCodeObj.value;
  },

  createMessageURI: function (originalUrl, contentType, contentCharset, contentData, persist) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.createMessageURI: "+originalUrl+
              ", "+contentType+", "+contentCharset+"\n");

    var messageId = "msg" + Math.floor(Math.random()*1.0e9);

    this._messageIdList[messageId] = {originalUrl:originalUrl,
                                      contentType:contentType,
                                      contentCharset:contentCharset,
                                      contentData:contentData,
                                      persist:persist};

    return "enigmail:message/"+messageId;
  },

  deleteMessageURI: function (uri) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.deleteMessageURI: "+uri+"\n");

    var messageId = ExtractMessageId(uri);

    if (!messageId)
      return false;

    return (delete this._messageIdList[messageId]);
  },

  invalidateUserIdList: function () {
    // clean the userIdList to force reloading the list at next usage
    this.userIdList= null;
  },

  // returns the output of -with-colons --list[-secret]-keys
  getUserIdList: function  (secretOnly, refresh, exitCodeObj, statusFlagsObj, errorMsgObj) {

    if (secretOnly || refresh || this.userIdList == null) {
      var args = Ec.getAgentArgs(true);

      if (secretOnly) {
        args=args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-secret-keys"]);
      }
      else {
        args=args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-keys"]);
      }

      if (!this.initialized) {
        Ec.ERROR_LOG("enigmail.js: Enigmail.getUserIdList: not yet initialized\n");
        errorMsgObj.value = Ec.getString("notInit");
        return "";
      }

      statusFlagsObj.value = 0;

      var statusMsgObj   = new Object();
      var cmdErrorMsgObj = new Object();

      var listText = this.execCmd(this.agentPath, args, null, "",
                        exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

      if (exitCodeObj.value != 0) {
        errorMsgObj.value = Ec.getString("badCommand");
        if (cmdErrorMsgObj.value) {
          errorMsgObj.value += "\n" + Ec.printCmdLine(this.agentPath, args);
          errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
        }

        return "";
      }

      listText=listText.replace(/(\r\n|\r)/g, "\n");
      if (secretOnly) {
        return listText;
      }
      this.userIdList = listText;
    }
    else {
      exitCodeObj.value=0;
      statusFlagsObj.value=0;
      errorMsgObj.value="";
    }

    return this.userIdList;
  },

  // returns the output of --with-colons --list-sig
  getKeySig: function  (keyId, exitCodeObj, errorMsgObj) {

    var keyIdList = keyId.split(" ");
    var args = Ec.getAgentArgs(true);
    args=args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-sig"]);
    args=args.concat(keyIdList);

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.getKeySig: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();

    var listText = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (exitCodeObj.value != 0) {
      errorMsgObj.value = Ec.getString("badCommand");
      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + Ec.printCmdLine(this.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }
    return listText;
  },

  getKeyDetails: function (keyId, uidOnly) {
      // uidOnly==true also means to only show UIDs with highest trust level
    var args = Ec.getAgentArgs(true);
    var keyIdList = keyId.split(" ");
    args=args.concat([ "--fixed-list-mode", "--with-colons", "--list-keys"]);
    args=args.concat(keyIdList);

    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();
    var statusFlagsObj = new Object();
    var exitCodeObj = new Object();

    var listText = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);
    if (exitCodeObj.value != 0) {
      return "";
    }
    listText=listText.replace(/(\r\n|\r)/g, "\n");

    const trustLevels = "oidre-qmnfu";
    var maxTrustLevel = -1;

    if (uidOnly) {
      var userList="";
      var hideInvalidUid=true;
      var keyArr=listText.split(/\n/);
      for (var i=0; i<keyArr.length; i++) {
        switch (keyArr[i].substr(0,4)) {
        case "pub:":
          if ("idre".indexOf(keyArr[i].split(/:/)[1]) >= 0) {
            // pub key not valid (anymore)-> display all UID's
            hideInvalidUid = false;
          }
        case "uid:":
          var theLine=keyArr[i].split(/:/);
          if (uidOnly && hideInvalidUid) {
            var thisTrust = trustLevels.indexOf(theLine[1]);
            if (thisTrust > maxTrustLevel) {
              userList = theLine[9] + "\n";
              maxTrustLevel = thisTrust;
            }
            else if (thisTrust == maxTrustLevel) {
              userList += theLine[9] + "\n";
            }
            // else do not add uid
          }
          else if (("idre".indexOf(theLine[1]) < 0) || (! hideInvalidUid)) {
            // UID valid or key not valid
            userList += theLine[9] + "\n";
          }
        }
      }
      return userList.replace(/^\n+/, "").replace(/\n+$/, "").replace(/\n\n+/g, "\n");
    }

    return listText;
  },

  // returns the output of --with-colons --list-config
  getGnupgConfig: function  (exitCodeObj, errorMsgObj) {

    var args = Ec.getAgentArgs(true);

    args=args.concat(["--fixed-list-mode", "--with-colons", "--list-config"]);

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.getGnupgConfig: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();
    var statusFlagsObj = new Object();

    var listText = this.execCmd(this.agentPath, args, null, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (exitCodeObj.value != 0) {
      errorMsgObj.value = Ec.getString("badCommand");
      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + Ec.printCmdLine(this.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }

    listText=listText.replace(/(\r\n|\r)/g, "\n");
    return listText;
  },


  encryptAttachment: function (parent, fromMailAddr, toMailAddr, bccMailAddr, sendFlags, inFile, outFile,
            exitCodeObj, statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.encryptAttachment infileName="+inFile.path+"\n");

    if (!this.initialized) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.encryptAttachment: not yet initialized\n");
      errorMsgObj.value = Ec.getString("notInit");
      return "";
    }

    statusFlagsObj.value = 0;
    sendFlags |= nsIEnigmail.SEND_ATTACHMENT;

    var asciiArmor = false;
    try {
      asciiArmor = this.prefBranch.getBoolPref("inlineAttachAsciiArmor");
    } catch (ex) {}
    var asciiFlags = (asciiArmor ? ENC_TYPE_ATTACH_ASCII : ENC_TYPE_ATTACH_BINARY);

    var args = this.getEncryptCommand(fromMailAddr, toMailAddr, bccMailAddr, "", sendFlags, asciiFlags, errorMsgObj);

    if (! args)
        return null;

    var passphrase = null;
    var signMessage = (sendFlags & nsIEnigmail.SEND_SIGNED);

    if (signMessage ) {
      args = args.concat(Ec.passwdCommand());

      var passwdObj = new Object();
      var useAgentObj = new Object();

      if (!Ec.getPassphrase(parent, passwdObj, useAgentObj, 0)) {
         Ec.ERROR_LOG("enigmail.js: Enigmail.encryptAttachment: Error - no passphrase supplied\n");

         statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
         return null;
      }

      passphrase = passwdObj.value;
    }

    var inFilePath  = this.getEscapedFilename(getFilePath(inFile.QueryInterface(getLocalFileApi())));
    var outFilePath = this.getEscapedFilename(getFilePath(outFile.QueryInterface(getLocalFileApi())));

    args = args.concat(["--yes", "-o", outFilePath, inFilePath ]);

    var statusMsgObj   = new Object();
    var cmdErrorMsgObj = new Object();

    var msg = this.execCmd(this.agentPath, args, passphrase, "",
                      exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (exitCodeObj.value != 0) {

      if (cmdErrorMsgObj.value) {
        errorMsgObj.value = Ec.printCmdLine(this.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }
      else {
        errorMsgObj.value = "An unknown error has occurred";
      }

      return "";
    }

    return msg;
  },


  getAttachmentFileName: function (parent, inputBuffer) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.getAttachmentFileName\n");

    var args = Ec.getAgentArgs(true);
    args = args.concat(Ec.passwdCommand());
    args.push("--list-packets");

    var passphrase = null;
    var passwdObj = new Object();
    var useAgentObj = new Object();

    if (!Ec.getPassphrase(parent, passwdObj, useAgentObj, 0)) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.getAttachmentFileName: Error - no passphrase supplied\n");
      return null;
    }

    var dataLength = new Object();
    var byteData = inputBuffer.getByteData(dataLength);

    passphrase = passwdObj.value;

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var statusMsgObj   = new Object();
    var errorMsgObj    = new Object();

    var ipcBuffer = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
    ipcBuffer.open(MSG_BUFFER_SIZE, true);

    var pipeTrans = this.execStart(this.agentPath, args, false, parent, 0,
                                   ipcBuffer, statusFlagsObj);


    if (!pipeTrans) {
      return null;
    }

    try {
      if (Ec.requirePassword()) {
        pipeTrans.writeSync(passphrase, passphrase.length);
        pipeTrans.writeSync("\n", 1);
      }
      pipeTrans.write(byteData, dataLength.value);
      pipeTrans.write("\n", 1);
    }
    catch (ex) {
      return null;
    }

    // Wait for child STDOUT to close
    pipeTrans.join();

    exitCodeObj.value = pipeTrans.exitValue;

    var statusMsgObj = new Object();
    var cmdLineObj   = new Object();

    try {
      this.execEnd(pipeTrans, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);
    }
    catch (ex) {};

    outputTxt = ipcBuffer.getData();

    var matches = outputTxt.match(/:literal data packet:\r?\n.*name="(.*)",/m);
    if (matches && (matches.length > 1)) {
      var filename = escape(matches[1]).replace(/%5Cx/g, "%")
      return Ec.convertToUnicode(unescape(filename), "utf-8")
    }
    else
      return null;
  },

  verifyAttachment: function (parent, verifyFile, sigFile,
                              statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.verifyAttachment:\n");

    var exitCode        = -1;
    var verifyFilePath  = this.getEscapedFilename(getFilePath(verifyFile.QueryInterface(getLocalFileApi())));
    var sigFilePath     = this.getEscapedFilename(getFilePath(sigFile.QueryInterface(getLocalFileApi())));

    var args = Ec.getAgentArgs(true);
    args.push("--verify");
    args.push(sigFilePath);
    args.push(verifyFilePath);

    var statusMsgObj   = new Object();

    var ipcBuffer = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
    ipcBuffer.open(MSG_BUFFER_SIZE, false);

    var pipeTrans = this.execStart(this.agentPath, args, false, parent, 0,
                                   ipcBuffer, statusFlagsObj);


    if (!pipeTrans) {
      return false;
    }

    // Wait for child STDOUT to close
    pipeTrans.join();

    exitCode = pipeTrans.exitValue;

    var statusMsgObj = new Object();
    var cmdLineObj   = new Object();

    try {
      this.execEnd(pipeTrans, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);
    }
    catch (ex) {};

    return exitCode;
  },


  decryptAttachment: function (parent, outFile, displayName, inputBuffer,
            exitCodeObj, statusFlagsObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.decryptAttachment: parent="+parent+", outFileName="+outFile.path+"\n");

    var dataLength = new Object();
    var byteData = inputBuffer.getByteData(dataLength);
    var attachmentHead = byteData.substr(0,200);
    if (attachmentHead.match(/\-\-\-\-\-BEGIN PGP \w+ KEY BLOCK\-\-\-\-\-/)) {
      // attachment appears to be a PGP key file

      if (this.confirmMsg(parent, Ec.getString("attachmentPgpKey", [ displayName ]),
            Ec.getString("keyMan.button.import"), Ec.getString("dlg.button.view"))) {
        exitCodeObj.value = this.importKey(parent, 0, byteData, "", errorMsgObj);
        statusFlagsObj.value = gStatusFlags.IMPORTED;
      }
      else {
        exitCodeObj.value = 0;
        statusFlagsObj.value = nsIEnigmail.DISPLAY_MESSAGE;
      }
      return true;
    }

    var outFileName = this.getEscapedFilename(getFilePath(outFile.QueryInterface(getLocalFileApi()), NS_WRONLY));

    var args = Ec.getAgentArgs(true);
    args = args.concat(["-o", outFileName, "--yes"]);
    args = args.concat(Ec.passwdCommand());
    args.push("-d");


    statusFlagsObj.value = 0;

    var passphrase = null;
    var passwdObj = new Object();
    var useAgentObj = new Object();

    if (!Ec.getPassphrase(parent, passwdObj, useAgentObj, 0)) {
      Ec.ERROR_LOG("enigmail.js: Enigmail.decryptAttachment: Error - no passphrase supplied\n");

      statusFlagsObj.value |= nsIEnigmail.MISSING_PASSPHRASE;
      return null;
    }

    passphrase = passwdObj.value;

    var ipcBuffer = Cc[NS_IPCBUFFER_CONTRACTID].createInstance(Ci.nsIIPCBuffer);
    ipcBuffer.open(MSG_BUFFER_SIZE, false);

    var pipeTrans = this.execStart(this.agentPath, args, false, parent, 0,
                                   ipcBuffer, statusFlagsObj);


    if (!pipeTrans) {
      return false;
    }

    try {
      if (Ec.requirePassword()) {
        pipeTrans.writeSync(passphrase, passphrase.length);
        pipeTrans.writeSync("\n", 1);
      }
      pipeTrans.write(byteData, dataLength.value);

    }
    catch (ex) {
      return false;
    }
    // Wait for child STDOUT to close
    pipeTrans.join();

    exitCodeObj.value = pipeTrans.exitValue;

    var statusMsgObj = new Object();
    var cmdLineObj   = new Object();

    try {
      this.execEnd(pipeTrans, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);
    }
    catch (ex) {};


    return true;

  },

  getCardStatus: function(exitCodeObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.getCardStatus\n");
    var args = Ec.getAgentArgs(false);

    args = args.concat(["--status-fd", "2", "--fixed-list-mode", "--with-colons", "--card-status"]);
    var statusMsgObj = new Object();
    var statusFlagsObj = new Object();

    var outputTxt = this.execCmd(this.agentPath, args, null, "",
                  exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

    if ((exitCodeObj.value == 0) && !outputTxt) {
      exitCodeObj.value = -1;
      return "";
    }

    return outputTxt;
  },

  showKeyPhoto: function(keyId, photoNumber, exitCodeObj, errorMsgObj) {
    Ec.DEBUG_LOG("enigmail.js: Enigmail.showKeyPhoto, keyId="+keyId+" photoNumber="+photoNumber+"\n");

    var args = Ec.getAgentArgs();
    args = args.concat(["--no-secmem-warning", "--no-verbose", "--no-auto-check-trustdb", "--batch", "--no-tty", "--status-fd", "1", "--attribute-fd", "2" ]);
    args = args.concat(["--fixed-list-mode", "--list-keys", keyId]);

    var photoDataObj = new Object();

    var outputTxt = this.simpleExecCmd(this.agentPath, args, exitCodeObj, photoDataObj);

    if ((exitCodeObj.value == 0) && !outputTxt) {
      exitCodeObj.value = -1;
      return "";
    }

    if (this.isDosLike) {
      // workaround for error in gpg
      photoDataObj.value=photoDataObj.value.replace(/\r\n/g, "\n");
    }

  // [GNUPG:] ATTRIBUTE A053069284158FC1E6770BDB57C9EB602B0717E2 2985
    var foundPicture = -1;
    var skipData = 0;
    var imgSize = -1;
    var statusLines = outputTxt.split(/[\n\r+]/);

    for (var i=0; i < statusLines.length; i++) {
      var matches = statusLines[i].match(/\[GNUPG:\] ATTRIBUTE ([A-F\d]+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)/)
      if (matches && matches[3]=="1") {
        // attribute is an image
        ++foundPicture;
        if (foundPicture == photoNumber) {
          imgSize = Number(matches[2]);
          break;
        }
        else {
          skipData += Number(matches[2]);
        }
      }
    }

    if (foundPicture>=0 && foundPicture == photoNumber) {
      var pictureData = photoDataObj.value.substr(16+skipData, imgSize);
      if (! pictureData.length)
        return "";
      try {
        var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;

        var ds = Cc[DIR_SERV_CONTRACTID].getService();
        var dsprops = ds.QueryInterface(Ci.nsIProperties);
        var picFile = dsprops.get("TmpD", Ci.nsIFile);

        picFile.append(keyId+".jpg");
        picFile.createUnique(picFile.NORMAL_FILE_TYPE, DEFAULT_FILE_PERMS);

        var fileStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
        fileStream.init(picFile, flags, DEFAULT_FILE_PERMS, 0);
        if (fileStream.write(pictureData, pictureData.length) != pictureData.length)
            throw Components.results.NS_ERROR_FAILURE;

        fileStream.flush();
        fileStream.close();
      }
      catch (ex) {
        exitCodeObj.value = -1;
        return "";
      }
    }
    return picFile.path;
  },


  // Methods for handling Per-Recipient Rules

  getRulesFile: function () {
    Ec.DEBUG_LOG("enigmail.js: getRulesFile\n");
    var ds = Cc[DIR_SERV_CONTRACTID].getService();
    var dsprops = ds.QueryInterface(Ci.nsIProperties);
    var rulesFile = dsprops.get("ProfD", getLocalFileApi());
    rulesFile.append("pgprules.xml");
    return rulesFile;
  },

  loadRulesFile: function () {
    Ec.DEBUG_LOG("enigmail.js: loadRulesFile\n");
    var flags = NS_RDONLY;
    var rulesFile = this.getRulesFile();
    if (rulesFile.exists()) {
      var fileContents = EnigReadFile(rulesFile);

      if (fileContents.length==0 || fileContents.search(/^\s*$/)==0) {
        return false;
      }

      var domParser=Cc[NS_DOMPARSER_CONTRACTID].createInstance(Ci.nsIDOMParser);
      this.rulesList = domParser.parseFromString(fileContents, "text/xml");

      return true;
    }
    return false;
  },

  saveRulesFile: function () {
    Ec.DEBUG_LOG("enigmail.js: saveRulesFile\n");

    var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;
    var domSerializer=Cc[NS_DOMSERIALIZER_CONTRACTID].createInstance(Ci.nsIDOMSerializer);
    var rulesFile = this.getRulesFile();
    if (rulesFile) {
      if (this.rulesList) {
        // the rule list is not empty -> write into file
        return WriteFileContents(rulesFile.path,
                               domSerializer.serializeToString(this.rulesList.firstChild),
                               DEFAULT_FILE_PERMS);
      }
      else {
        // empty rule list -> delete rules file
        try {
          rulesFile.remove(false);
        }
        catch (ex) {}
        return true;
      }
    }
    else
      return false;
  },

  getRulesData: function (rulesListObj) {
    Ec.DEBUG_LOG("enigmail.js: getRulesData\n");
    var ret=true;
    if (! this.rulesList) {
       ret=this.loadRulesFile();
    }
    if (this.rulesList) {
      rulesListObj.value = this.rulesList;
      return ret;
    }

    rulesListObj.value = null;
    return false;
  },

  addRule: function (appendToEnd, toAddress, keyList, sign, encrypt, pgpMime, flags) {
    Ec.DEBUG_LOG("enigmail.js: addRule\n");
    if (! this.rulesList) {
      var domParser=Cc[NS_DOMPARSER_CONTRACTID].createInstance(Ci.nsIDOMParser);
      this.rulesList = domParser.parseFromString("<pgpRuleList/>", "text/xml");
    }
    var negate = (flags & 1);
    var rule=this.rulesList.createElement("pgpRule");
    rule.setAttribute("email", toAddress);
    rule.setAttribute("keyId", keyList);
    rule.setAttribute("sign", sign);
    rule.setAttribute("encrypt", encrypt);
    rule.setAttribute("pgpMime", pgpMime);
    rule.setAttribute("negateRule", flags);
    var origFirstChild = this.rulesList.firstChild.firstChild;

    if (origFirstChild && (! appendToEnd)) {
      this.rulesList.firstChild.insertBefore(rule, origFirstChild);
      this.rulesList.firstChild.insertBefore(this.rulesList.createTextNode(this.isDosLike ? "\r\n" : "\n"), origFirstChild);
    }
    else {
      this.rulesList.firstChild.appendChild(rule);
      this.rulesList.firstChild.appendChild(this.rulesList.createTextNode(this.isDosLike ? "\r\n" : "\n"));
    }

  },

  clearRules: function () {
    this.rulesList = null;
  }

} // Enigmail.protoypte


function EnigCmdLineHandler() {}

EnigCmdLineHandler.prototype = {
  classDescription: "Enigmail Key Management CommandLine Service",
  classID:  NS_ENIGCLINE_SERVICE_CID,
  contractID: NS_CLINE_SERVICE_CONTRACTID,
  _xpcom_categories: [{
    category: "command-line-handler",
    entry: "cline-enigmail",
    service: false
  }],
  QueryInterface: XPCOMUtils.generateQI([nsICommandLineHandler, nsIFactory, nsISupports]),

  // nsICommandLineHandler
  handle: function(cmdLine) {
    if (cmdLine.handleFlag("pgpkeyman", false)) {
      cmdLine.preventDefault = true; // do not open main app window

      var wwatch = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                             .getService(Ci.nsIWindowWatcher);
      wwatch.openWindow(null, "chrome://enigmail/content/enigmailKeyManager.xul", "_blank",
                        "chrome,dialog=no,all", cmdLine);
    }
  },

  helpInfo: "  -pgpkeyman         Open the OpenPGP key management.\n",

  lockFactory: function (lock) {}
};


function enigExtractHashAlgo(msgTxt) {
  Ec.DEBUG_LOG("enigmail.js: enigExtractHashAlgo\n");

  var m = msgTxt.match(/^(Hash: )(.*)$/m);
  if (m.length > 2 && m[1] == "Hash: ") {
    var hashAlgorithm = m[2].toLowerCase();
    for (var i=1; i < gMimeHashAlgorithms.length; i++) {
      if (gMimeHashAlgorithms[i] == hashAlgorithm) {
        Ec.DEBUG_LOG("enigmail.js: enigExtractHashAlgo: found hashAlgorithm "+hashAlgorithm+"\n");
        return hashAlgorithm;
      }
    }
  }

  Ec.DEBUG_LOG("enigmail.js: enigExtractHashAlgo: no hashAlgorithm found\n");
  return null;
}

///////////////////////////////////////////////////////////////////////////////

var NSGetFactory = XPCOMUtils.generateNSGetFactory([Enigmail, EnigmailProtocolHandler, EnigCmdLineHandler]);
dump("enigmail.js: Registered components\n");
