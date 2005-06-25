 /*
 * $HeadURL$
 * $LastChangedBy$
 * $Date$
 * $Revision$
 *
 */

function openWindow(parent, url, target, features, args) {
  var wwatch = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                         .getService(Components.interfaces.nsIWindowWatcher);

  var argstring;
  if (args) {
    argstring = Components.classes["@mozilla.org/supports-string;1"]
                            .createInstance(Components.interfaces.nsISupportsString);
    argstring.data = args;
  }
  return wwatch.openWindow(parent, url, target, features, argstring);
}

function windowLoaded()
{
	dump("windowLoaded\n");
	var gBrowser=this.document.getElementById("content");
	gBrowser.addEventListener("load", pageLoaded, true);
}

function pageLoaded(event)
{
	dump("pageLoaded\n");

  var webBrowserPrint = event.originalTarget.defaultView.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
               .getInterface(Components.interfaces.nsIWebBrowserPrint);
	var printSettings;
	try {
    var PSSVC = Components.classes["@mozilla.org/gfx/printsettings-service;1"]
                          .getService(Components.interfaces.nsIPrintSettingsService);
    printSettings = PSSVC.globalPrintSettings;
    if (!printSettings.printerName)
      printSettings.printerName = PSSVC.defaultPrinterName;

    // First get any defaults from the printer 
    PSSVC.initPrintSettingsFromPrinter(printSettings.printerName, printSettings);
    // now augment them with any values from last time
    PSSVC.initPrintSettingsFromPrefs(printSettings, true,  printSettings.kInitSaveAll);
  } catch (e) {
    dump("getPrintSettings: "+e+"\n");
  }
  try {
  	var listener = new nsPrintProgressListener(this.ownerDocument.defaultView);
  	listener.QueryInterface(Components.interfaces.nsIWebProgressListener);
    webBrowserPrint.print(printSettings, listener);
  } catch (e) { }
  dump("Done\n");
	//var window=this.ownerDocument.defaultView;
}

function nsPrintProgressListener(window)
{
	this.window=window;
}

nsPrintProgressListener.prototype=
{
	window: null,
	
	// Start of nsIWebProgressListener implementation
	onLocationChange: function(webProgress, request, location)
	{
		dump("LocationChange\n");
	},
	
	onProgressChange: function(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress)
	{
		dump("ProgressChange\n");
	},
	
	onSecurityChange: function(webProgress, request, state)
	{
		dump("SecurityChange\n");
	},
	
	onStateChange: function(webProgress, request, stateFlags, status)
	{
		dump("StateChange - "+stateFlags+"\n");
		if (stateFlags&Components.interfaces.nsIWebProgressListener.STATE_STOP)
		{
			this.window.close();
		}
	},
	
	onStatusChange: function(webProgress, request, status, message)
	{
		dump("StatusChange\n");
	},
	// End of nsIWebProgressListener implementation
	
	// Start of nsISupports implementation
	QueryInterface: function (iid)
	{
		if (iid.equals(Components.interfaces.nsIWebProgressListener)
			|| iid.equals(Components.interfaces.nsISupports))
		{
			return this;
		}
		else
		{
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
	}
	// End of nsISupports implementation
}

function nsFirefoxPrintHandler()
{
}

nsFirefoxPrintHandler.prototype =
{
	mChromeURL : null,

  get chromeURL()
  {
    if (this.mChromeURL)
    {
      return this.mChromeURL;
    }

    var prefb = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);
    this.mChromeURL = prefb.getCharPref("browser.chromeURL");

    return this.mChromeURL;
  },
  
 	// Start of nsICommandLineHandler implementation
	handle: function(cmdline)
	{
		var path = cmdline.handleFlagWithParam("print",true);
		if (path)
		{
			var uri=cmdline.resolveURI(path);
			dump("Found url to print: "+uri.spec+"\n");
			cmdline.preventDefault=true;
			dump("Loading: "+this.chromeURL+"\n");
			var window=openWindow(null, this.chromeURL, "_blank",
                   "chrome,dialog=no,all", uri.spec);
      window.addEventListener("load", windowLoaded, false);
		}
	},
	
	helpInfo: "firefox -print <url>",
	// End of nsICommandLineHandler implementation
	
	// Start of nsISupports implementation
	QueryInterface: function (iid)
	{
		if (iid.equals(Components.interfaces.nsICommandLineHandler)
			|| iid.equals(Components.interfaces.nsISupports))
		{
			return this;
		}
		else
		{
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
	}
	// End of nsISupports implementation
}

var initModule =
{
	ServiceCID: Components.ID("{231ca50f-bebe-47f8-a892-dd711e75cd10}"),
	ServiceContractID: "@blueprintit.co.uk/firefox-print-handler;1",
	ServiceName: "Firefox Print Handler Service",
	
	registerSelf: function (compMgr, fileSpec, location, type)
	{
		compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.registerFactoryLocation(this.ServiceCID,this.ServiceName,this.ServiceContractID,
			fileSpec,location,type);
			
		var catMan = Components.classes["@mozilla.org/categorymanager;1"]
                            .getService(Components.interfaces.nsICategoryManager);

    catMan.addCategoryEntry("command-line-handler", "m-print",
                            this.ServiceContractID, true, true);
	},

	unregisterSelf: function (compMgr, fileSpec, location)
	{
		compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.unregisterFactoryLocation(this.ServiceCID,fileSpec);

		var catMan = Components.classes["@mozilla.org/categorymanager;1"]
                            .getService(Components.interfaces.nsICategoryManager);

		catMan.deleteCategoryEntry("command-line-handler",
                                "m-print", true);
	},

	getClassObject: function (compMgr, cid, iid)
	{
		if (!cid.equals(this.ServiceCID))
			throw Components.results.NS_ERROR_NO_INTERFACE
		if (!iid.equals(Components.interfaces.nsIFactory))
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
		return this.serviceFactory;
	},

	canUnload: function(compMgr)
	{
		return true;
	},

	serviceFactory:
	{
		service: null,
		
		createInstance: function (outer, iid)
		{
			if (outer != null)
				throw Components.results.NS_ERROR_NO_AGGREGATION;
			if (this.service==null)
			{
				this.service=new nsFirefoxPrintHandler();
			}
			return this.service.QueryInterface(iid);
		}
	}
}; //Module

function NSGetModule(compMgr, fileSpec)
{
	return initModule;
}
