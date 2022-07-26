// ---------------------------------------------------------------------
// <copyright file="HiGHContextHandle.js" company="HiGH Software BV">
//      Copyright (c) HiGH Software BV.  All rights reserved.
// </copyright>
// ---------------------------------------------------------------------

(function () {
    'use strict';

    //Package the DataValue into the dataTransfer object
    self.dragStart = function (event) {
        event.dataTransfer.setData("text", event.target.id);
        event.dataTransfer.effectAllowed = "copyMove";
    }

    //Accept drops from outside (For future implementation)
    self.allowDrop = function (event) {
        event.preventDefault();
    }

    //Accept drops from outside (For future implementation)
    self.drop = function (event) {
    }
    
    self.makeguid = function makeguid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
              .toString(16)
              .substring(1);
        }
        return 'highContextHandle_' +
            s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }

    //---Main
    //Defaults
    $dyn.ui.defaults.HiGHContextHandle = {
    };

    //Control
    $dyn.controls.HiGHContextHandle = function (control, element) {
        var control = this;
        
        $dyn.telemetry.enabled = false;
        $dyn.ui.Control.apply(control, arguments);
        $dyn.ui.applyDefaults(this, control, $dyn.ui.defaults.HiGHContextHandle);

        /*Temp disabled for demo
        var contextMenu = $dyn.value(control.DataValue);

        //Ensure the context menu gets drawn inside the viewport
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (contextMenu.offsetHeight) {
                    contextMenu.style.top = (contextMenu.offsetTop + contextMenu.offsetHeight > $(window).height() ? $(window).height() - contextMenu.offsetHeight - 10 : contextMenu.style.offsetTop) + 'px';
                    contextMenu.style.left = (contextMenu.offsetLeft + contextMenu.offsetWidth > $(window).width() ? $(window).width() - contextMenu.offsetWidth - 10 : contextMenu.style.offsetLeft) + 'px';
                }
            });
        });

        var config = { attributes: true, childList: false, characterData: false };
        observer.observe(contextMenu, config);
        */
        //Menu item click
        control.onMenuItemClick = function (event) {
            var menuItem = event.target;

            var onMenuItemClicked = $dyn.value(control.OnMenuItemClicked);

            if (onMenuItemClicked) {
                onMenuItemClicked({ _menuItemId: event.target.id });
            }
        }

        //Right clicked on <body>
        $("body").contextmenu(function (event) {
            if ((event.target.getAttribute('data-high-objecttype') != null) && (event.target.getAttribute('data-high-objecttype') == "HiGHContextHandle")) {
                var OnContextChanged = $dyn.value(control.OnContextChanged);

                if (OnContextChanged) {
                    var contextHandleEventArgs = {
                        DataValue: event.target.getAttribute('data-highcontexthandle-datavalue'),
                        DataSourceName: event.target.getAttribute('data-highcontexthandle-datasourcename'),
                        DisplayValue: event.target.getAttribute('data-highcontexthandle-displayvalue')
                    }

                    OnContextChanged({ _contextHandleEventArgs: JSON.stringify(contextHandleEventArgs) }, null);

                    //Show context menu
                    if (event.target.getAttribute('data-highcontexthandle-datavalue') == $dyn.value(control.DataValue)) {

                        $('.showContextHandleMenu').className = "hideContextHandleMenu";

                       var contextMenu = document.getElementById(event.target.getAttribute('data-highcontexthandle-datavalue'));
                        contextMenu.className = "showContextHandleMenu";
                    }

                    window.event.returnValue = false;
                    event.originalEvent.stopPropagation();
                }
            }
        });

        //Left clicked on <body>
        $("body").click(function (event) {
            //Hide context menu
            var contextMenu = document.getElementById($dyn.value(control.DataValue));

            if (contextMenu)
                contextMenu.className = "hideContextHandleMenu";
        });

        control.controlGuid = self.makeguid();
    };

    //Prototype
    $dyn.controls.HiGHContextHandle.prototype = $dyn.extendPrototype($dyn.ui.Control.prototype, {
    });
})();
