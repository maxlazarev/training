// ---------------------------------------------------------------------
// <copyright file="HiGHPlanBoard.js" company="HiGH Software BV">
//      Copyright (c) HiGH Software BV.  All rights reserved.
// </copyright>
// ---------------------------------------------------------------------

(function () {
    'use strict';

    //Actual vars
    var lastSelectedPlannedEvent;
    var lastSelectedPlannedEventOrigLeft;
    var lastSelectedPlannedEventOrigWidth;

    var firstSelectedPeriod;
    var lastSelectedPeriod;

    var startDragMouseX;
    var startDragMouseY;

    var scrollBarWidth;
    var scrollBarHeight;

    var resizingSide = "";
    var periodSelection = "";
    var rowItemSpaceHeaderWidth = 0;
    var rowItemSpaceHeaderHeaderWidth = 0;

    var controlWidth = 0;
    var controlHeight = 0;

    var cntrlIsPressed = false;

    self.dragStartPlannedEvent = function (event) {
        lastSelectedPlannedEvent = event.currentTarget;
        event.dataTransfer.setData("Text", event.target.id);
        startDragMouseX = mouseX(event);
        startDragMouseY = mouseY(event);
    }

    //---Utilities:
    //Round n to nearest factor of f
    function roundToFactor(n, f) {
        return Math.round(n / f) * f;
    }

    //Find mouse position
    function mouseX(evt) {
        if (evt.pageX) {
            return evt.pageX;
        } else if (evt.clientX) {
            return evt.clientX + (document.documentElement.scrollLeft ?
                document.documentElement.scrollLeft :
                document.body.scrollLeft);
        } else {
            return null;
        }
    }

    function mouseY(evt) {
        if (evt.pageY) {
            return evt.pageY;
        } else if (evt.clientY) {
            return evt.clientY + (document.documentElement.scrollTop ?
                document.documentElement.scrollTop :
                document.body.scrollTop);
        } else {
            return null;
        }
    }

    //This method will be deprecated in the near future (TODO: WPLO)
    function icons2HTML(icons) {
        var iconsHTML = '';

        if (icons.indexOf('A') > -1) {
            iconsHTML += '<img class="plannedEventIcons" src="resources/Images/green.gif" title="Delivered" />';
        }
        if (icons.indexOf('B') > -1) {
            iconsHTML += '<img class="plannedEventIcons" src="resources/Images/conflict.png" title="In progress" />';
        }
        if (icons.indexOf('C') > -1) {
            iconsHTML += '<img class="plannedEventIcons" src="resources/Images/ProcessDefinition_Appointment.gif" title="In transit" />';
        }

        return iconsHTML;
    }

    //Check if period falls within a range of periods
    function isWithinPeriod(startPeriodElement, endPeriodElement, targetPeriodElement) {
        var startPeriod = parseInt(startPeriodElement.getAttribute('data-highplanboard-startperiod'));
        var endPeriod = parseInt(endPeriodElement.getAttribute('data-highplanboard-startperiod'));
        var targetPeriod = parseInt(targetPeriodElement.getAttribute('data-highplanboard-startperiod'));

        if (startPeriodElement.getAttribute('data-highplanboard-rowitemid') != targetPeriodElement.getAttribute('data-highplanboard-rowitemid'))
            return false;

        if (startPeriod > endPeriod) {
            endPeriod = endPeriod + startPeriod;
            startPeriod = endPeriod - startPeriod;
            endPeriod = endPeriod - startPeriod;
        }

        return ((startPeriod <= targetPeriod) && (targetPeriod <= endPeriod));
    }

    //Convert int to color
    self.int2color = function (color) {
        var r = Math.floor(color / (256 * 256));
        var g = Math.floor(color / 256) % 256;
        var b = color % 256;
        var a = 255;

        return 'rgba(' + [r, g, b, a].join(',') + ')';
    }

    //Convert int to darker color
    self.int2darkColor = function (color) {
        var r = Math.floor(color / (256 * 256));
        var g = Math.floor(color / 256) % 256;
        var b = color % 256;
        var a = 255;

        return 'rgba(' + [r - 20, g - 20, b - 20, a].join(',') + ')';
    }

    //Get foreground color from background color
    self.intBackground2Foreground = function (color) {
        var r = Math.floor(color / (256 * 256));
        var g = Math.floor(color / 256) % 256;
        var b = color % 256;
        var a = 255;
        var d = 0;

        // Counting the perceptive luminance - human eye favors green color...
        var a = 1 - (0.299 * r + 0.587 * g + 0.114 * r) / 255;

        if (a < 0.5) // bright colors - black font
            d = 0;
        else         // dark colors - white font
            d = 255;

        return 'rgba(' + [d, d, d, 255].join(',') + ')';
    }

    //---Main
    //Defaults
    $dyn.ui.defaults.HiGHPlanBoard = {
        PeriodMinHeight: 21
    };

    //Control
    $dyn.controls.HiGHPlanBoard = function (control, element) {
        var control = this;

        $dyn.telemetry.enabled = false;
        $dyn.ui.Control.apply(control, arguments);
        $dyn.ui.applyDefaults(this, control, $dyn.ui.defaults.HiGHPlanBoard);

        //Ensure the context menu gets drawn inside the viewport
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                var contextMenu = document.getElementById("HiGHPlanBoardContextMenu");

                if (contextMenu != null && contextMenu.offsetHeight) {
                    contextMenu.style.top = (contextMenu.offsetTop + contextMenu.offsetHeight > $(window).height() ? $(window).height() - contextMenu.offsetHeight - 10 : contextMenu.style.offsetTop) + 'px';
                    contextMenu.style.left = (contextMenu.offsetLeft + contextMenu.offsetWidth > $(window).width() ? $(window).width() - contextMenu.offsetWidth - 10 : contextMenu.style.offsetLeft) + 'px';
                }
            });
        });

        var config = { attributes: true, childList: false, characterData: false };
        observer.observe(document.getElementById("HiGHPlanBoardContextMenu"), config);


        var Grid = function () {
            var instance = this;

            var canvas = element.querySelector('canvas.grid-layout');
            var canvasContext = canvas ? canvas.getContext('2d') : null;
            var detailNode = element.querySelector('#detail');
            var periodSpaceSheet = element.querySelector('#periodSpaceSheet');

            var width = 0;
            var height = 0;
            var debounceRedraw;
            var cellWidth = 1;
            var highlightedCell = null;
            var colors = {
                border: {
                    normal: '#EAEAEA',
                    hover: 'darkgrey'
                },
                background: {
                    normal: '#FFFFFF',
                    selected: '#ADD8E6',
                    disabled: '#E4EEF7'
                }
            };
            var cells = [];
            var controlCells = [];
            var dragging = false;
            var selectedRowCell = null;
            var resourcesCellNodes;
            var periodCellNodes;
            var draggingFromOutside = false;
            var bodyMouseMoveInterval;

            var coordinatesToCell = function (x, y) {

                if (cells) {
                    for (var row = 0; row < cells.length; ++row) {
                        var cell = cells[row][0];
                        if (y >= cell.top && y <= cell.top + cell.height) {
                            break;
                        }
                    }
                } else {
                    var row = 0;
                }
                if (cells[0]) {
                    for (var column = 0; column < cells[0].length; ++column) {
                        var cell = cells[0][column];
                        if (x >= cell.left && x <= cell.left + cell.width) {
                            break;
                        }
                    }
                } else {
                    var column = 0;
                }

                if (typeof (cells[row]) === "undefined") {
                    row = cells.length - 1;
                }

                if (typeof (cells[row][column]) === "undefined") {
                    column = cells[0].length - 1;
                }

                return cells[row][column];
            };

            var cellIsCurrentHighlighedCell = function (cell) {

                if (!cell) {
                    return cell === highlightedCell;
                }

                if (!highlightedCell) {
                    return false;
                }

                return highlightedCell.row == cell.row && highlightedCell.column == cell.column;
            };

            var rowHeight = function (row) {
                return resourcesCellNodes[row + 1].offsetHeight;
            };

            var resetSelected = function () {
                firstSelectedPeriod = null;
                lastSelectedPeriod = null;
                selectedRowCell = null;
                for (var row = 0; row < cells.length; ++row) {
                    var rowCells = cells[row];
                    for (var column = 0; column < rowCells.length; ++column) {
                        var cell = rowCells[column];
                        if (cell.selected) {
                            cell.selected = false;
                            instance.renderCell(cell);
                        }
                    }
                }
            };

            var renderSelectedCellsInCurrentRange = function () {
                if (dragging) {
                    var columnsCount = cells[0].length;
                    var minColumn = columnsCount;
                    var maxColumn = 0;

                    for (var column = 0; column < columnsCount; ++column) {
                        if (cells[dragging.row][column].selected) {
                            if (column < minColumn) {
                                minColumn = column;
                            }

                            if (column > maxColumn) {
                                maxColumn = column;
                            }
                        }
                    }

                    for (column = minColumn; column <= maxColumn; ++column) {
                        var cell = cells[dragging.row][column];
                        cell.selected = true;
                        instance.renderCell(cell);
                    }
                }
            }

            var getCellFakeNode = function (cell) {
                var fakeCellNode = document.createElement('div');

                fakeCellNode.setAttribute('data-highplanboard-plannedEventrow', 'plannedEventRow_' + cell.rowItemId);
                fakeCellNode.setAttribute('data-highplanboard-startperiod', cell.periodId);
                fakeCellNode.setAttribute('data-highplanboard-endperiod', cell.periodId);
                fakeCellNode.setAttribute('data-high-objecttype', 'HiGHPlanBoardPeriod');
                fakeCellNode.setAttribute('data-high-isopen', cell.open);
                fakeCellNode.setAttribute('data-highplanboard-rowitemid', cell.rowItemId);
                fakeCellNode.setAttribute('id', 'divPeriod_' + cell.periodId + '_' + cell.rowItemId);

                return fakeCellNode;
            };

            var getCellAtMouseEvent = function (ev) {

                var rect = periodSpaceSheet.getBoundingClientRect();
                return coordinatesToCell(ev.clientX - rect.left + periodSpaceSheet.scrollLeft, ev.clientY - rect.top);
            };

            var drop = function (ev) {

                var cell = getCellAtMouseEvent(ev);
                var fakeCellNode = getCellFakeNode(cell);

                control.onPlannedEventDrop({
                    target: fakeCellNode,
                    originalEvent: ev,
                    view: {
                        event: ev
                    },
                    isGridCaller: true
                });
            };

            var positionOverElement = function (position, element) {
                var elementRect = element.getBoundingClientRect();

                if (position.top >= elementRect.top && position.top <= elementRect.top + elementRect.height) {
                    if (position.left > elementRect.left && position.left < elementRect.left + elementRect.width) {
                        return true;
                    }
                }
                return false;
            };

            var contextmenu = function (ev) {
                var target = ev.target;

                if (target.classList.contains('rowItemPeriodSpace') || target.classList.contains('grid-layout')) {

                    var cell = getCellAtMouseEvent(ev);
                    var fakeCellNode = getCellFakeNode(cell);

                    if (!cell.selected) {
                        resetSelected();
                        cell.selected = true;
                        instance.renderCell(cell);
                        selectedRowCell = cell;
                    }

                    if (selectedRowCell) {
                        var columnsCount = cells[0].length;
                        var minColumn = columnsCount;
                        var maxColumn = 0;

                        for (var column = 0; column < columnsCount; ++column) {
                            if (cells[selectedRowCell.row][column].selected) {
                                if (column < minColumn) {
                                    minColumn = column;
                                }

                                if (column > maxColumn) {
                                    maxColumn = column;
                                }
                            }
                        }



                        firstSelectedPeriod = getCellFakeNode(cells[selectedRowCell.row][minColumn]);
                        lastSelectedPeriod = getCellFakeNode(cells[selectedRowCell.row][maxColumn]);
                    }

                    control.changeContextElement(firstSelectedPeriod ? firstSelectedPeriod : fakeCellNode);

                    //Show context menu
                    var contextMenu = document.getElementById("HiGHPlanBoardContextMenu");
                    //contextMenu.className = "planBoardContextShow";
                    contextMenu.style.left = mouseX(ev) + 'px';
                    contextMenu.style.top = mouseY(ev) + 'px';
                    contextMenu.style.display = "none";
                    document.body.style.cursor = "wait";

                    window.event.returnValue = false;
                    ev.preventDefault();

                    ev.stopPropagation();
                }
            };

            var dragover = function (ev) {
                ev.preventDefault();
            };

            this.init = function () {

                if (!canvas) {
                    return false;
                }

                periodSpaceSheet.insertBefore(canvas, periodSpaceSheet.firstChild);

                periodSpaceSheet.addEventListener('mousemove', instance.mousemove);
                periodSpaceSheet.addEventListener('mouseout', instance.mouseout);
                periodSpaceSheet.addEventListener('mousedown', instance.mousedown);
                periodSpaceSheet.addEventListener('mouseup', instance.mouseup);
                periodSpaceSheet.addEventListener('dragover', dragover);
                periodSpaceSheet.addEventListener('drop', drop);
                periodSpaceSheet.addEventListener('contextmenu', contextmenu);

                document.body.addEventListener('mousedown', instance.bodyMousedown);
                document.body.addEventListener('mouseup', instance.bodyMouseup);
                window.addEventListener('drag', bodyDrag);


                periodCellNodes = element.querySelectorAll('.periodRows:last-child>div');
                resourcesCellNodes = element.querySelectorAll('.rowItemRows:last-child>div');

                cells.length = 0;
                controlCells = control.RowItems();

                for (var row = 0; row < resourcesCellNodes.length - 1; ++row) {
                    var gridRow = [];
                    for (var column = 0; column < periodCellNodes.length - 1; ++column) {
                        var cellData = controlCells[row].RowPeriods[column];
                        gridRow.push({
                            selected: false,
                            hovered: false,
                            row: row,
                            column: column,
                            top: 0,
                            left: 0,
                            height: 0,
                            width: 0,
                            open: cellData.Open,
                            background: cellData.Open ? colors.background.normal : colors.background.disabled,
                            periodId: cellData.PeriodId,
                            rowItemId: controlCells[row].RowItemId
                        });
                    }
                    cells.push(gridRow);
                }

                computeCellSizes();
            };

            var bodyDrag = function (ev) {
                if (draggingFromOutside) {
                    var mousePosition = {
                        'left': ev.pageX,
                        'top': ev.pageY
                    };
                    var offset = 50;
                    var canvasRect = element.getBoundingClientRect();
                    if (canvasRect.height > offset * 2) {
                        if (mousePosition.top >= canvasRect.top && mousePosition.top <= canvasRect.top + offset) {
                            detailNode.scrollTop -= 10;
                        } else {
                            if (mousePosition.top >= canvasRect.top + canvasRect.height - offset && mousePosition.top <= canvasRect.top + canvasRect.height) {
                                detailNode.scrollTop += 10;
                            }
                        }
                    }
                }
            };

            var computeCellSizes = function () {
                var top = 0;
                var left = 0;

                for (var row = 0; row < resourcesCellNodes.length - 1; ++row) {
                    left = 0;
                    var rowHeight = parseInt(resourcesCellNodes[row + 1].getBoundingClientRect().height);
                    for (var column = 0; column < periodCellNodes.length - 1; ++column) {
                        var cellWidth = periodCellNodes[column].offsetWidth;
                        var cell = cells[row][column];

                        cell.top = top;
                        cell.left = left;
                        cell.width = cellWidth;
                        cell.height = rowHeight;

                        left += cellWidth;
                    }
                    top += rowHeight;
                }
            };

            this.renderCell = function (cell) {

                if (cell.selected) {
                    canvasContext.fillStyle = colors.background.selected;
                } else {
                    canvasContext.fillStyle = cell.background;
                }

                canvasContext.fillRect(cell.left, cell.top, cell.width, cell.height);

                if (cell.hovered) {
                    canvasContext.fillStyle = colors.border.hover;
                } else {
                    canvasContext.fillStyle = colors.border.normal;
                }

                canvasContext.fillRect(cell.left, cell.top, cell.width, 1);
                canvasContext.fillRect(cell.left, cell.top + cell.height, cell.width, 1);

                canvasContext.fillRect(cell.left, cell.top, 1, cell.height);
                canvasContext.fillRect(cell.left + cell.width, cell.top, 1, cell.height);
            };

            this.highlightCell = function (cell) {
                if (!cell || !cellIsCurrentHighlighedCell(cell)) {
                    if (highlightedCell) {
                        highlightedCell.hovered = false;
                        instance.renderCell(highlightedCell);
                    }

                    if (cell) {
                        cell.hovered = true;
                        instance.renderCell(cell);
                        highlightedCell = cell;
                    } else {
                        highlightedCell = null;
                    }
                }
            };

            this.bodyMousedown = function (ev) {
                if (!draggingFromOutside && !positionOverElement({ 'left': ev.pageX, 'top': ev.pageY }, canvas)) {
                    draggingFromOutside = true;
                }
            };

            this.mousemove = function (ev) {
                if (dragging) {
                    var rect = periodSpaceSheet.getBoundingClientRect();
                    var cell = coordinatesToCell(ev.clientX - rect.left + periodSpaceSheet.scrollLeft, ev.clientY - rect.top);

                    instance.highlightCell(cell);

                    cells[dragging.row][cell.column].selected = true;
                    renderSelectedCellsInCurrentRange();
                }
            };

            this.mouseout = function (ev) {
                instance.highlightCell(null);
            };

            this.mousedown = function (ev) {
                if (!dragging && ev.target.classList.contains('rowItemPeriodSpace') && ev.which == 1) {
                    resetSelected();
                    var rect = periodSpaceSheet.getBoundingClientRect();
                    dragging = coordinatesToCell(ev.clientX - rect.left + periodSpaceSheet.scrollLeft, ev.clientY - rect.top);
                    dragging.selected = true;
                    selectedRowCell = dragging;

                    instance.renderCell(dragging);
                }
            };

            this.mouseup = function (ev) {
                dragging = false;
            };

            this.drawVerticalLines = function () {
                var periodCellNodes = element.querySelectorAll('.periodRows:last-child>div');

                canvasContext.fillStyle = colors.border.normal;
                var x = 0;
                var lineWidth = 1;
                for (var column = 0; column < periodCellNodes.length - 1; ++column) {
                    canvasContext.fillRect(x, 0, 1, height);
                    x += periodCellNodes[column].offsetWidth;
                }
            };

            this.drawHorizontalLines = function () {

                canvasContext.fillStyle = colors.border.normal;
                var y = 0;
                var lineWidth = 1;
                for (var row = 1; row < resourcesCellNodes.length; ++row) {
                    canvasContext.fillRect(0, y, width, 1);
                    y += parseInt(resourcesCellNodes[row].getBoundingClientRect().height);
                }
            };

            this.resizeAndPosition = function () {
                //canvas.style.left = control.RowItemWidth() + 'px';

                var periodSpaceHeader = element.querySelector('#periodSpaceHeader');

                periodCellNodes = element.querySelectorAll('.periodRows:last-child>div');
                resourcesCellNodes = element.querySelectorAll('.rowItemRows:last-child>div');

                var rows = element.querySelectorAll('.rowItemPeriodSpace');
                cellWidth = periodCellNodes[0].offsetWidth;
                computeCellSizes();

                width = cellWidth * (periodCellNodes.length - 1);
                height = 0;
                for (var i = 1, c = resourcesCellNodes.length; i < c; ++i) {
                    height += parseInt(resourcesCellNodes[i].getBoundingClientRect().height);
                    rows[i - 1].style.width = width + 'px';
                }
                                
                canvas.width = width;
                canvas.height = height;

                periodSpaceSheet.style.height = height + 'px';
                //periodSpaceSheet.style.width = width + 'px';

                canvasContext.fillStyle = '#FFF';
                canvasContext.fillRect(0, 0, width, height);

                control.renderScrollBars();
            };

            this.redraw = function () {

                if (!canvas) {
                    return false;
                }

                clearTimeout(debounceRedraw);
                debounceRedraw = setTimeout(function () {

                    instance.resizeAndPosition();
                    instance.drawVerticalLines();
                    instance.drawHorizontalLines();

                    for (var row = 0; row < cells.length; ++row) {
                        var rowCells = cells[row];
                        for (var column = 0; column < rowCells.length; ++column) {
                            instance.renderCell(rowCells[column]);
                        }
                    }

                }, 100);

                var cssWidth = width + 'px';
                var rows = element.querySelectorAll('.rowItemPeriodSpace');

                for (var row = 1; row < resourcesCellNodes.length; ++row) {
                    var rowNode = resourcesCellNodes[row];
                    var height = (parseInt(rowNode.attributes['data-collisionlevel'].value) + 1) * parseInt(rowNode.attributes['data-periodheight'].value)
                    rows[row - 1].style.height = height + 'px';
                    rows[row - 1].style.width = cssWidth;
                    if (height > 1) {
                        rowNode.style.height = rows[row - 1].style.height;
                    }
                }
            };
        };

        var grid = new Grid();


        control.plannedEventLabelLoad = function (event) {

            var planning = $dyn.value(control.RowItems);

            for (var rowItemIndex in planning) {
                var rowItem = planning[rowItemIndex];
                rowItem.RowPeriods = JSON.parse(rowItem.RowPeriods);
                for (var plannedEventIndex in rowItem.PlannedEvents) {
                    var plannedEvent = planning[rowItemIndex].PlannedEvents[plannedEventIndex];

                    var plannedEventLabelElement = document.getElementById('label_' + plannedEvent.PlanningId);
                    if (plannedEventLabelElement != null)
                        plannedEventLabelElement.innerHTML = (plannedEvent.CellContent == null || plannedEvent.CellContent.length === 0) ? plannedEvent.EventId : plannedEvent.CellContent;

                    var plannedEventSymbolElement = document.getElementById('symbol_' + plannedEvent.PlanningId);
                    if (plannedEventSymbolElement != null)
                        plannedEventSymbolElement.innerHTML = icons2HTML(plannedEvent.Icons); //TODO: Change this to work like menu items - Using the macro (WPLO)
                }
            }

            grid.init();
            control.applySizing(true);

            var delayedCheck = setInterval(function () { checkSizing() }, 1000)

            function checkSizing() {
                control.applySizing(false);
                clearInterval(delayedCheck)
            }

            var redraw = function () {
                var elem = $('#ganttControl_mainContainer');
                var viewport = elem.find('#detail.row');
                var relativeParent = elem.closest('.fill-height');
                var offset = viewport.offset().top - relativeParent.offset().top;

                viewport.css('height', relativeParent.height() - offset);
                control.applySizing(false);
                control.renderScrollBars();
            };

            $('#ganttControl_mainContainer').on('elementResize', redraw);
            setTimeout(function () {		
            $('#ganttControl_mainContainer').closest('.fill-height').on('elementResize', redraw);		
            }, 1000);
            redraw();
            setTimeout(redraw, 0);


            // JM
            addResizeListener($('div.planBoard')[0], function (event) {
                /*
                var elem = $(this),
                    width = elem.width(),
                    height = elem.height();
                var headerHeight = ($dyn.value(control.showPeriodLabels())) ? 35 : 18;
                var maxHeight = 1000; //todo: calculate max height = no of resources * max height per resource + header

                if ($('#ganttControl_mainContainer')[0] != null && (elem.height() - headerHeight) <= maxHeight) {
                    $('#ganttControl_mainContainer')[0].style.height = (elem.height() - headerHeight) + "px";

                    console.log("height changed:" + $('#ganttControl_mainContainer')[0].style.height);
                    control.applySizing(false);
                }
                */
                var elem = $(this);
                var ganttControl = elem.find('#ganttControl_mainContainer');
                control.applySizing(false);
                control.renderScrollBars();
            });
        }


        control.applySizing = function (_force) {
            if ($dyn.value(control.PlanBoardMode) != 1) {
                //There wil always only be one
                //document.getElementsByClassName('planBoard').item(0).style.overflow = 'auto';
            }

            //Inform server
            var mainContainer = document.getElementById("ganttControl_mainContainer");
            if (controlWidth != mainContainer.clientWidth || _force) {
                controlWidth = mainContainer.clientWidth

                var onChangeControlWidth = $dyn.value(control.OnChangeControlWidth);

                if (onChangeControlWidth)
                    onChangeControlWidth({ _width: JSON.stringify(controlWidth) });
            }

            if (controlHeight != mainContainer.clientHeight || _force) {
                controlHeight = mainContainer.clientHeight

                var onChangeControlHeight = $dyn.value(control.OnChangeControlHeight);

                if (onChangeControlHeight)
                    onChangeControlHeight({ _height: controlHeight });
            }

            mainContainer.style.display = 'none';
            mainContainer.style.display = 'block';

            grid.redraw();
        }

        //Scroll back to top of context menu when the items change
        $dyn.observe(control.ContextMenuItems, function () {
            var contextMenu = document.getElementById("HiGHPlanBoardContextMenu");
            var cmi = $dyn.value(control.ContextMenuItems);
            document.body.style.cursor = "";
            contextMenu.style.display = (cmi != null && cmi.length > 0) ? "block" : "none";
            contextMenu.scrollTop = 0;
        });

        //Scroll to specified horizontal location (Usually after a redraw, called form server)
        $dyn.observe(control.ScrollPositionHorizontal, function () {
            $('#periodSpaceSheet').scrollLeft($dyn.value(control.ScrollPositionHorizontal));
        });

        //Scroll to specified vertical location (Usually after a redraw, called form server)
        $dyn.observe(control.ScrollPositionHorizontal, function () {
            $('#periodSpaceSheet').scrollTop($dyn.value(control.ScrollPositionHorizontal));
        });

        //Monitor keyboard presses
        $(document).keydown(function (event) {
            //Ctrl is pressed (Used for multiselect)
            if (event.which == "17")
                cntrlIsPressed = true;
        });

        $(document).keyup(function () {
            //Clear all monitored keys
            cntrlIsPressed = false;
        });

        //Right clicked on <body>
        $("body").contextmenu(function (event) {
            var element = event.target;

            while (element.getAttribute('data-high-objecttype') == null) {
                element = element.parentElement;

                if (element == null) return;
            }

            switch (element.className) {
                case 'HiGHContextHandleMain':
                    setTimeout(function () {
                        var x = mouseX(event);
                        var y = mouseY(event);
                        var contextMenu = $('.showContextHandleMenu');

                        var checkForContentInterval;
                        var checkForContent = function () {
                            if (contextMenu.html() && contextMenu.height()) {
                                clearInterval(checkForContentInterval);

                                var offsetY = contextMenu.outerHeight() - ($(window).height() - y);
                                var offsetX = contextMenu.outerWidth() - ($(window).width() - x);

                                contextMenu.css({
                                    'top': y - (offsetY > 0 ? offsetY : 0),
                                    'left': x - (offsetX > 0 ? offsetX : 0)
                                });
                            }
                        }

                        checkForContentInterval = setInterval(checkForContent, 200);

                        contextMenu.css({
                            'top': y,
                            'left': x
                        });
                    }, 1)
                    break;
                case 'plannedEventLabel':
                case 'plannedEventSymbol':
                    element = element.parentElement.parentElement;
                    break;
            }

            if ((element.getAttribute('data-high-objecttype') != null) && (element.getAttribute('data-high-objecttype') != "HiGHContextHandle")) {
                //Update context object
                if (element.className == 'plannedEvent')
                    control.selectPlannedEvent(element);

                control.changeContextElement(element);

                //Show context menu
                var contextMenu = document.getElementById("HiGHPlanBoardContextMenu");
                //contextMenu.className = "planBoardContextShow";
                contextMenu.style.left = mouseX(event) + 'px';
                contextMenu.style.top = mouseY(event) + 'px';
                contextMenu.style.display = "none";
                document.body.style.cursor = "wait";

                window.event.returnValue = false;
                event.preventDefault();

                event.originalEvent.stopPropagation();
            }
        });

        //Left clicked on <body>
        $("body").click(function (event) {
            //Hide context menu
            var contextMenu = document.getElementById("HiGHPlanBoardContextMenu");

            //JM new -->
            if (contextMenu != null && contextMenu.style.display != 'none') {
                contextMenu.style.left = "0px";
                contextMenu.style.top = "0px";
                contextMenu.style.display = "none";
                $('body').trigger({
                    type: 'mousedown',
                    which: 3
                });
            }
            // <-- JM new
        });

        //Mouse button released (Drop) on <body>
        $("body").mouseup(function (event) {
            //When mouseUp after dragging plannedEventSlider
            if (resizingSide && resizingSide != "rowItem" && lastSelectedPlannedEvent) {
                control.onPlannedEventResize(event);
                lastSelectedPlannedEvent.style.zIndex = 1;
                lastSelectedPlannedEvent.setAttribute("draggable", true);
            }

            //When mouseUp after resizing row item column
            if (resizingSide == "rowItem") {
                resizingSide = "";
            }

            //When mouseUp after selecting periods
            if (periodSelection) {
                periodSelection = false;
            }
        });

        //Mouse move on <body> (Possible dragging)
        $("body").mousemove(function (event) {
            var newOffsetLeft;
            var newOffsetWidth;

            if (resizingSide == "left") {
                newOffsetLeft = lastSelectedPlannedEventOrigLeft + roundToFactor(mouseX(event) - startDragMouseX, $dyn.value(control.PeriodWidth));
                newOffsetWidth = lastSelectedPlannedEvent.offsetWidth + (lastSelectedPlannedEvent.offsetLeft - newOffsetLeft);
                grid.redraw();
            }
            else if (resizingSide == "right") {
                newOffsetLeft = lastSelectedPlannedEvent.offsetLeft;
                newOffsetWidth = lastSelectedPlannedEventOrigWidth + roundToFactor(mouseX(event) - startDragMouseX, $dyn.value(control.PeriodWidth));
                grid.redraw();
            }
            else if (resizingSide == "rowItem") {
                newOffsetWidth = event.clientX - startDragMouseX;

                //Inform server
                var updateRowItemWidth = $dyn.value(control.updateRowItemWidth);

                if (updateRowItemWidth)
                    updateRowItemWidth({ _rowItemWidth: JSON.stringify((rowItemSpaceHeaderWidth + newOffsetWidth)) });

                grid.redraw();
                return;
            }

            if (resizingSide && ((newOffsetLeft >= 0) && (newOffsetWidth >= $dyn.value(control.PeriodWidth)))) {
                //Adjust UI
                lastSelectedPlannedEvent.style.left = newOffsetLeft + "px";
                lastSelectedPlannedEvent.style.width = newOffsetWidth + "px";

                var plannedEventContainerElement = document.getElementById('container_' + lastSelectedPlannedEvent.id);
                plannedEventContainerElement.style.width = (newOffsetWidth - 10) + "px"; //Hardcoded 10px to allow space for sliders
                grid.redraw();
            }

            if (periodSelection) {
                //Find period under pointer and select as lastSelectedPeriod
                //JM: added non-ms support for elementsfrompoint (chrome 43+)
                var elements = null;
                if (document.msElementsFromPoint)
                    elements = Array.prototype.slice.call(document.msElementsFromPoint(event.clientX, startDragMouseY), 0);
                else if (document.elementsFromPoint)
                    elements = Array.prototype.slice.call(document.elementsFromPoint(event.clientX, startDragMouseY), 0);
                if (elements != null) {
                    elements.forEach(function (element) {
                        if (element.getAttribute('data-high-objecttype') == 'HiGHPlanBoardPeriod') {
                            if ((lastSelectedPeriod == null) || (element.id != lastSelectedPeriod.id))
                                control.selectLastPeriod(element);
                        }
                    });
                }
            }
        });

        control.onMainContainerResize = function (event) {
            alert("main windows resize");
        }


        //Sync scrolling of periods and rowitems
        control.onPeriodSpaceSheetScrolls = function (event) {
            $('#rowItemSpaceHeader').scrollTop($('#periodSpaceSheet').scrollTop());
            $('#periodSpaceHeader').scrollLeft($('#periodSpaceSheet').scrollLeft());

            //Inform server of change. This will be used to move the view to the last position after it has been refreshed
            var updateScrollPositionVertical = $dyn.value(control.OnScrollPositionVertical);

            if (updateScrollPositionVertical)
                updateScrollPositionVertical({ _scrollPositionVertical: JSON.stringify($('#periodSpaceSheet').scrollTop()) }, null);

            var updateScrollPositionHorizontal = $dyn.value(control.OnScrollPositionHorizontal);

            if (updateScrollPositionHorizontal)
                updateScrollPositionHorizontal({ _scrollPositionHorizontal: JSON.stringify($('#periodSpaceSheet').scrollLeft()) }, null);

        }

        //Background functions
        //---Period Events
        //Accept the potential drop
        control.onPlannedEventDragOver = function (event) {
            //if (event.target.getAttribute("data-high-isopen") == "true")
            event.preventDefault();
        }
        //---PlannedEvent Events
        //PlannedEvent onClick
        control.onPlannedEventClick = function (event) {
            control.selectLastPeriod();
            control.selectPlannedEvent(event.currentTarget, cntrlIsPressed);
        }

        //Select PlannedEvent
        control.selectPlannedEvent = function (element, multiselect) {
            //Restore previously selected PlannedEvent
            if (lastSelectedPlannedEvent != null && (!multiselect || !$dyn.value(control.AllowMultiSelectPE))) {
                $(".plannedEvent").removeClass("plannedEvent_selected");
            }

            //Set class for new
            lastSelectedPlannedEvent = element;
            $(element).addClass("plannedEvent_selected");
        }

        //PlannedEvent sliders
        control.onMouseDownSlider = function (event) {
            resizingSide = event.target.getAttribute('data-highplanboard-slider');
            startDragMouseX = mouseX(event);
            if (resizingSide != "rowItem") {
                control.selectPlannedEvent(event.currentTarget.parentElement, false);
                lastSelectedPlannedEvent.setAttribute("draggable", false);

                lastSelectedPlannedEventOrigLeft = lastSelectedPlannedEvent.offsetLeft;
                lastSelectedPlannedEventOrigWidth = lastSelectedPlannedEvent.offsetWidth;
            }
            else {
                rowItemSpaceHeaderWidth = event.target.parentElement.offsetWidth;
                rowItemSpaceHeaderHeaderWidth = document.getElementById("rowItemSpaceHeaderHeader").offsetWidth;
            }
            $(event.target).closest('.plannedEvent').css('z-index', 1000);
        }

        //Select first Period
        control.selectFirstPeriod = function (element) {
            //Unselect any planned events
            //TODO: Still needed?

            //Set class for new
            firstSelectedPeriod = element;
            $(firstSelectedPeriod).addClass("periodCell_selected");
        }

        //Select last Period
        control.selectLastPeriod = function (element) {
            var periodCount = control.getPeriodCount();

            if (firstSelectedPeriod != null)
                var rowItemId = firstSelectedPeriod.getAttribute('data-highplanboard-rowitemid');

            if (element == null && rowItemId) {
                for (var x = 0; x <= periodCount; x++) {
                    var currentPeriod = document.getElementById('divPeriod_' + x + '_' + rowItemId);
                    $(currentPeriod).removeClass("periodCell_selected");
                }

                firstSelectedPeriod = null;
                lastSelectedPeriod = null;

                return;
            }

            //Set class for new
            lastSelectedPeriod = element;

            if (firstSelectedPeriod) {
                var firstPeriod = parseInt(firstSelectedPeriod.getAttribute('data-highplanboard-startperiod'));
                var lastPeriod = parseInt(lastSelectedPeriod.getAttribute('data-highplanboard-startperiod'));

                //If dragging right to left, swop start and end
                if (firstPeriod > lastPeriod) {
                    firstPeriod = lastPeriod;
                    lastPeriod = parseInt(firstSelectedPeriod.getAttribute('data-highplanboard-startperiod'));
                }

                for (var x = firstPeriod; x <= lastPeriod; x++) {
                    var currentPeriod = document.getElementById('divPeriod_' + x + '_' + rowItemId);

                    if (currentPeriod && currentPeriod.className.search("periodCell_selected") == -1)
                        $(currentPeriod).addClass("periodCell_selected");
                }
            }
        }

        //Calculate width of the row item header in pixels (We deduct half the width of the periods, to ensure the labels are positioned in a logical readable way)
        control.calcRowItemHeaderWidth = function () {
            //JM:old
            if ($dyn.value(control.showPeriodLabels())) {
                // standard: show period labels
                return ($dyn.value(control.RowItemWidth)) + 'px';
            }
            else {
                // no periods: move controls accordlingly
                $("div#header")[0].style.height = '18px';
                //$("div#periodSpaceHeader div:first-child div:first-child").hide(); //disable aligner
                return $dyn.value(control.RowItemWidth) + 'px';
            }
        }

        //Calculate the remaining visible width used for the periods
        control.calcPeriodSpaceWidth = function (rowItemWidth) {
            //return ($dyn.value(control.Width) - parseInt(rowItemWidth, 10)) + 'px';
            return ($dyn.value(control.ControlWidth) - parseInt(rowItemWidth, 10)) + 'px';
        }

        //Calculate the remaining visible height used for the periods
        control.calcPeriodSpaceHeight = function () {
            //TODO: Make this a property on the contol (WPLO)
            //JM OLD: return ($dyn.value(control.ControlHeight) - 30) + 'px'
            //JM NEW: -->
            var spaceHeight = 30;
            $("div.rowItemCell").each(function () {
                spaceHeight += $(this).height;
            });
            return spaceHeight + "px";
            // <-- JM NEW
        }

        //Check if primary period labels should be visible
        control.showPeriodLabels = function () {
            return ($dyn.value(control.PlanBoardMode) != 1);
        }

        //Check if plannedEvents can be resized
        control.allowResize = function () {
            return ($dyn.value(control.PlanBoardMode) != 1);
        }

        //Determines the height of the scrollbars
        control.getScrollBarHeight = function () {
            var $outer = $('<div>').css({ visibility: 'hidden', height: 100, overflow: 'scroll' }).appendTo('body'),
                heightHeightScroll = $('<div>').css({ height: '100%' }).appendTo($outer).outerHeight();
            $outer.remove();
            return 100 - heightHeightScroll;
        };

        // JM NEW -->
        //Determines the height of the scrollbars
        control.getScrollBarHeightItemSpace = function () {
            var $outer = $('<div>').css({ visibility: 'hidden', height: 100, overflow: 'scroll' }).appendTo('body'),
                heightHeightScroll = $('<div>').css({ height: '100%' }).appendTo($outer).outerHeight();
            $outer.remove();

            // calculate whether horizontal scrolling is in effect
            //var RowItemWidth = $dyn.value(control.RowItemWidth);
            var periodWidth = $dyn.value(control.PeriodWidth);
            var periodCount = $dyn.value(control.Periods).length - 1;
            var neededWidth = (periodWidth * periodCount);

            var controlWidth = $("#periodSpaceSheet").width();
            if (neededWidth > controlWidth) {
                return 100 - heightHeightScroll;
            }
            return 0;
        };
        // <-- JM NEW

        //Gets the row count
        control.getRowItemCount = function () {
            var plannings = $dyn.value(control.RowItems);

            return plannings.length - 1;

        }

        //Gets the period count
        control.getPeriodCount = function () {
            var periods = $dyn.value(control.Periods);

            return periods.length - 1;
        }

        //Calculate width of PlannedEvent in pixels
        control.calcPlannedEventWidth = function (data) {
            return ((data.EndPeriod - data.StartPeriod) * $dyn.value(control.PeriodWidth)) + 'px';
        }

        //Calculate width of PlannedEvent label in pixels
        control.calcPlannedEventLabelWidth = function (data) {
            return (((data.EndPeriod - data.StartPeriod) * $dyn.value(control.PeriodWidth)) - 15) + 'px';
        }

        //Calculate height of PlannedEvent in pixels
        control.calcPlannedEventHeight = function () {
            return ($dyn.value(control.PeriodMinHeight) - 5) + 'px';
        }

        //Calculate absolute left of PlannedEvent in pixels
        control.calcPlannedEventLeft = function (data) {
            return ((data.StartPeriod + 1) * $dyn.value(control.PeriodWidth)) + 'px';
        }

        //Calculate absolute top of PlannedEvent in pixels
        control.calcPlannedEventTop = function (collisionLevel) {
            //console.log(collisionLevel, control.PeriodMinHeight, (collisionLevel * $dyn.value(control.PeriodMinHeight)) + 'px');
            return (collisionLevel * $dyn.value(control.PeriodMinHeight)) + 'px';
        }

        //Inform server of change in context element
        control.changeContextElement = function (element) {
            switch (element.className) {
                case 'plannedEventLabel':
                case 'plannedEventSymbol':
                    element = element.parentElement.parentElement;
                    break;
            }

            //Inform server of update
            var OnContextChanged = $dyn.value(control.OnContextChanged);

            if (OnContextChanged) {
                var type = element.getAttribute('data-high-objecttype');
                var contextObject;
                var contextObjectType;

                switch (type) {
                    //Create context object for HiGHPlanBoardPeriod / HiGHPlanBoardDateRange
                    case 'HiGHPlanBoardPeriod':
                        if ((firstSelectedPeriod != null) && (lastSelectedPeriod != null) && (firstSelectedPeriod.id != lastSelectedPeriod.id) && (isWithinPeriod(firstSelectedPeriod, lastSelectedPeriod, element))) {
                            if (parseInt(firstSelectedPeriod.getAttribute('data-highplanboard-startperiod')) > parseInt(lastSelectedPeriod.getAttribute('data-highplanboard-startperiod'))) {
                                var temp = lastSelectedPeriod;
                                lastSelectedPeriod = firstSelectedPeriod;
                                firstSelectedPeriod = temp;
                            }

                            contextObject = {
                                RowItemId: firstSelectedPeriod.getAttribute('data-highplanboard-rowitemid'),
                                StartPeriodId: +firstSelectedPeriod.getAttribute('data-highplanboard-startperiod') - 1,
                                EndPeriodId: +lastSelectedPeriod.getAttribute('data-highplanboard-endperiod')
                            }
                        }
                        else {
                            control.selectLastPeriod();
                            control.selectFirstPeriod(element);
                            control.selectLastPeriod(element);

                            contextObject = {
                                RowItemId: element.getAttribute('data-highplanboard-rowitemid'),
                                StartPeriodId: +element.getAttribute('data-highplanboard-startperiod'),
                                EndPeriodId: +element.getAttribute('data-highplanboard-startperiod')
                            };
                        }
                        if (contextObject.StartPeriodId == contextObject.EndPeriodId) {
                            contextObject.StartPeriodId--;
                        }


                        contextObjectType = 'HiGHPlanBoardOnContextPeriodEventArgs';
                        break;

                        //Create context object for HiGHPlanBoardPlannedEvent
                    case 'HiGHPlanBoardPlannedEvent':
                        var selectedEvents = document.getElementsByClassName("plannedEvent_selected");
                        var contextPlannedEvents = [];

                        for (var i = 0; i < selectedEvents.length; i++) {
                            contextObject = {
                                PlanningId: selectedEvents.item(i).id
                            }

                            contextPlannedEvents.push(contextObject);
                        }

                        contextObject = contextPlannedEvents;
                        contextObjectType = 'HiGHPlanBoardPlannedEventBaseArgs';
                        break;

                        //Create context object for HiGHPlanBoardRowItem
                    case 'HiGHPlanBoardRowItem':
                        var contextRowItems = [];

                        for (var i = 0; i < 1; i++) {
                            contextObject = {
                                RowItemId: element.id
                            }

                            contextRowItems[i] = (contextObject);
                        }

                        contextObject = { RowItems: contextRowItems }
                        contextObjectType = 'HiGHPlanBoardOnContextRowItemEventArgs';
                        break;
                }

                //Inform server
                OnContextChanged({ _contextClassName: contextObjectType, _context: JSON.stringify(contextObject) });
            }
        }

        //On dragging something over a rowitem
        control.onDragOverRowItem = function (event) {
            event.preventDefault();
        }

        //On dropping something on the rowItem
        control.onDropOnRowItem = function (event) {
            var targetObject = event.target;
            if (targetObject == null) return;

            //Check if dropped item originates from HiGHContextHandle
            var dragSource = document.getElementById(event.originalEvent.dataTransfer.getData("Text"));
            if (dragSource != null && dragSource.getAttribute('data-high-objecttype') == 'HiGHContextHandle') {
                //Inform server of update
                var onExternalDrop = $dyn.value(control.OnExternalDrop);

                if (onExternalDrop) {
                    var externalDropEventArgs = {
                        DataValue: dragSource.getAttribute('data-highcontexthandle-datavalue'),
                        DataSourceName: dragSource.getAttribute('data-highcontexthandle-datasourcename'),
                        DisplayValue: dragSource.getAttribute('data-highcontexthandle-displayvalue'),
                        TargetRowItemId: targetObject.getAttribute('data-highplanboard-rowitemid'),
                        TargetPeriodId: targetObject.getAttribute('data-highplanboard-startperiod')
                    }

                    onExternalDrop({ _externalDropEventArgs: JSON.stringify(externalDropEventArgs) }, null);
                }
            }
        }
        control.getRowHeight = function ($data, $index) {		
            var periodMinHeight = control.PeriodMinHeight();		
            var height = (periodMinHeight * ($data.MaxCollisionLevel + 1)) + ($index == control.getRowItemCount() ? control.getScrollBarHeightItemSpace() : 0);		
            var node = $('.rowItemCell[id="' + $data.RowItemId + '"]')[0];		
            setTimeout(function() {		
                if(node && node.style) {		
                    node.style.height = height + 'px';		
                }		
            }, 0);		
            return height;		
        };

        //Process PlannedEvent drop
        control.onPlannedEventDrop = function (event) {

            if (!event.isGridCaller) {
                return;
            }

            var targetObject = event.target;

            if (targetObject == null) return;

            var targetPlannedEventRow = document.getElementById(targetObject.getAttribute('data-highplanboard-plannedEventrow'));

            while (targetPlannedEventRow == null) {
                targetObject = targetObject.parentElement;

                if (targetObject == null) return;
                targetPlannedEventRow = document.getElementById(targetObject.getAttribute('data-highplanboard-plannedEventrow'));
            }

            //Check if dropped item originates from HiGHContextHandle
            var dragSource = document.getElementById(event.originalEvent.dataTransfer.getData("Text"));
            if (dragSource != null && dragSource.getAttribute('data-high-objecttype') == 'HiGHContextHandle') {
                //Inform server of update
                var onExternalDrop = $dyn.value(control.OnExternalDrop);

                if (onExternalDrop) {
                    var externalDropEventArgs = {
                        DataValue: dragSource.getAttribute('data-highcontexthandle-datavalue'),
                        DataSourceName: dragSource.getAttribute('data-highcontexthandle-datasourcename'),
                        DisplayValue: dragSource.getAttribute('data-highcontexthandle-displayvalue'),
                        TargetRowItemId: targetObject.getAttribute('data-highplanboard-rowitemid'),
                        TargetPeriodId: +targetObject.getAttribute('data-highplanboard-startperiod') - 1
                    }

                    onExternalDrop({ _externalDropEventArgs: JSON.stringify(externalDropEventArgs) }, null);
                }

                //If this was a legit drop, disregard the rest
                return;
            }

            //Check if this is a plannedEvent drop in DateOnly mode
            if ((dragSource != null) && (dragSource.getAttribute('data-high-objecttype') == 'HiGHPlanBoardPlannedEvent') && ($dyn.value(control.PlanBoardMode) == 1)) {
                //Inform server of update
                var onDateOnlyPlannedEventDrop = $dyn.value(control.OnDateOnlyPlannedEventDrop);

                if (onDateOnlyPlannedEventDrop) {
                    var dateOnlyPlannedEventDropEventArgs = [dragSource.id, (targetObject.getAttribute('data-high-objecttype') == 'HiGHPlanBoardPlannedEvent' ? targetObject.id : '0'), targetObject.getAttribute('data-highplanboard-rowitemid'), targetObject.getAttribute('data-highplanboard-startperiod')];

                    onDateOnlyPlannedEventDrop({ _dateOnlyPlannedEventDropArgs: JSON.stringify(dateOnlyPlannedEventDropEventArgs) }, null);
                }

                //If this was a legit drop, disregard the rest
                return;
            }

            //Standard plan board
            if (lastSelectedPlannedEvent == null) return;

            var periodDifference = roundToFactor(event.view.event.clientX - startDragMouseX, $dyn.value(control.PeriodWidth)) / $dyn.value(control.PeriodWidth);

            //Attach to new PlannedEventRow if required
            if (targetObject.getAttribute('data-highplanboard-plannedEventrow') != lastSelectedPlannedEvent.getAttribute('data-highplanboard-plannedEventrow')) {
                //Set new parent row item div
                lastSelectedPlannedEvent.setAttribute('data-highplanboard-plannedEventrow', targetObject.getAttribute('data-highplanboard-plannedEventrow'));

                //Set new row item
                lastSelectedPlannedEvent.setAttribute('data-highplanboard-rowitemid', targetObject.getAttribute('data-highplanboard-rowitemid'));

                //Append HTML in correct RowItem container. We do this here now, since we have everything we need already, and later only have to rearrange the PlannedEvent divs inside
                //the already correct plannedEventRow
                targetPlannedEventRow.appendChild(lastSelectedPlannedEvent);
            }

            //Inform server of update
            var onPlannedEventChanged = $dyn.value(control.OnPlannedEventChanged);

            if (onPlannedEventChanged) {
                var updatedPlannedEvent = {
                    PlanningId: lastSelectedPlannedEvent.id,
                    RowItemId: lastSelectedPlannedEvent.getAttribute('data-highplanboard-rowitemid'),
                    StartPeriod: +lastSelectedPlannedEvent.getAttribute('data-highplanboard-startperiod') + periodDifference,
                    EndPeriod: +lastSelectedPlannedEvent.getAttribute('data-highplanboard-endperiod') + periodDifference
                }

                onPlannedEventChanged({ _plannedEvent: JSON.stringify(updatedPlannedEvent), _action: 'move' }, control.onPlannedEventChangedResult);
            }
        }

        //Process PlannedEvent resize
        control.onPlannedEventResize = function (event) {
            var onPlannedEventChanged = $dyn.value(control.OnPlannedEventChanged);

            if (onPlannedEventChanged) {
                var updatedPlannedEvent;

                if (resizingSide == 'left') {
                    var periodDifference = roundToFactor(mouseX(event) - startDragMouseX, $dyn.value(control.PeriodWidth)) / $dyn.value(control.PeriodWidth);

                    updatedPlannedEvent = {
                        PlanningId: lastSelectedPlannedEvent.id,
                        StartPeriod: +lastSelectedPlannedEvent.getAttribute('data-highplanboard-startperiod') + periodDifference,
                        EndPeriod: +lastSelectedPlannedEvent.getAttribute('data-highplanboard-endperiod')
                    }
                }
                else {
                    var periodDifference = roundToFactor(mouseX(event) - startDragMouseX, $dyn.value(control.PeriodWidth)) / $dyn.value(control.PeriodWidth);

                    updatedPlannedEvent = {
                        PlanningId: lastSelectedPlannedEvent.id,
                        StartPeriod: +lastSelectedPlannedEvent.getAttribute('data-highplanboard-startperiod'),
                        EndPeriod: +lastSelectedPlannedEvent.getAttribute('data-highplanboard-endperiod') + periodDifference
                    }
                }

            }

            //Inform server
            onPlannedEventChanged({ _plannedEvent: JSON.stringify(updatedPlannedEvent), _action: resizingSide }, control.onPlannedEventChangedResult);
            resizingSide = "";
        }

        //Process periods selection
        control.onPeriodSelectClick = function (event) {
            if (event.which == 1) { //left clicked
                control.selectLastPeriod();
                control.selectFirstPeriod(event.currentTarget);
                control.selectLastPeriod(event.currentTarget);
            }
        }

        //Stat period selection for multi select
        control.onPeriodSelectMouseDown = function (event) {
            if (event.which == 1) {
                control.selectLastPeriod();
                control.selectFirstPeriod(event.currentTarget);
                periodSelection = true;
                startDragMouseX = mouseX(event);
                startDragMouseY = mouseY(event);
            }
        }

        //Menu item click
        control.onMenuItemClick = function (event) {
            var menuItem = event.target;

            var onMenuItemClicked = $dyn.value(control.OnMenuItemClicked);

            if (onMenuItemClicked) {
                onMenuItemClicked({ _menuItemId: event.target.id });
            }
        }

        //Handle result received from server after changing a plannedEvent
        control.onPlannedEventChangedResult = function (result) {
            for (var rowItemIndex in result) {
                var rowItem = result[rowItemIndex];

                if (rowItem == null)
                    continue;

                var rowItemCell = document.getElementById(rowItem.RowItemId);
                //var periodRow = document.getElementById('periodRow_' + rowItem.RowItemId);

                rowItemCell.style.height = (control.PeriodMinHeight() * (rowItem.MaxCollisionLevel + 1)) + (rowItem.RowNumber == control.getRowItemCount() ? control.getScrollBarHeight() : 0) + 'px';
                //periodRow.style.height = (control.PeriodMinHeight() * (rowItem.MaxCollisionLevel + 1)) + 'px';

                for (var plannedEventIndex in rowItem.PlannedEvents) {
                    var plannedEvent = result[rowItemIndex].PlannedEvents[plannedEventIndex];
                    //Get adjusted elements
                    var plannedEventElement = document.getElementById(plannedEvent.PlanningId);

                    if (plannedEventElement) {
                        //Set new dimensions
                        plannedEventElement.style.left = control.calcPlannedEventLeft(plannedEvent);
                        plannedEventElement.style.top = control.calcPlannedEventTop(plannedEvent.CollisionLevel);
                        plannedEventElement.style.width = control.calcPlannedEventWidth(plannedEvent);
                        plannedEventElement.style.height = control.calcPlannedEventHeight();
                        plannedEventElement.style.color = intBackground2Foreground(plannedEvent.EventColor);
                        plannedEventElement.style.background = int2color(plannedEvent.EventColor);

                        //Reset styles
                        $(plannedEventElement).removeClass("plannedEvent_openLeft");
                        $(plannedEventElement).removeClass("plannedEvent_openRight");

                        if (plannedEvent.StartPeriodOpen)
                            plannedEventElement.className += ' plannedEvent_openLeft';

                        if (plannedEvent.EndPeriodOpen)
                            plannedEventElement.className += ' plannedEvent_openRight';

                        //Set attributes
                        plannedEventElement.setAttribute('data-highplanboard-plannedEventrow', 'plannedEventRow_' + rowItem.RowItemId),
                            plannedEventElement.setAttribute('data-highplanboard-startperiod', plannedEvent.StartPeriod);
                        plannedEventElement.setAttribute('data-highplanboard-endperiod', plannedEvent.EndPeriod);
                        plannedEventElement.setAttribute('data-highplanboard-rowitemid', plannedEvent.RowItemId);

                        //Set updated properties
                        var plannedEventContainer = document.getElementById('container_' + plannedEventElement.id);
                        plannedEventContainer.style.width = control.calcPlannedEventLabelWidth(plannedEvent);

                        var plannedEventLabelElement = document.getElementById('label_' + plannedEventElement.id);
                        plannedEventLabelElement.innerHTML = (plannedEvent.CellContent == null || plannedEvent.CellContent.length === 0) ? plannedEvent.EventId : plannedEvent.CellContent;

                        var plannedEventSymbolElement = document.getElementById('symbol_' + plannedEventElement.id);
                        plannedEventSymbolElement.innerHTML = icons2HTML(plannedEvent.Icons);
                        //TODO: Set icons (WPLO)

                    }
                }
            }
        }

        var renderScrollBarsTimeout;
        control.renderScrollBars = function () {


            var periodSpaceHorizontalScroll = $('.periodSpaceHorizontalScroll');
            var periodSpaceSheetWidth = periodSpaceHorizontalScroll.find('.content-width-wrapper');
            var periodSpaceSheet = $('#periodSpaceSheet');

            var redraw = function () {
                clearTimeout(renderScrollBarsTimeout);

                renderScrollBarsTimeout = setTimeout(function () {
                    periodSpaceSheetWidth.css('width', periodSpaceSheet.prop('scrollWidth'));
                    periodSpaceHorizontalScroll.css('width', $('#periodSpaceHeader').width());
                }, 300);
            };

            if (!periodSpaceHorizontalScroll.length) {
                periodSpaceHorizontalScroll = $('<div class="periodSpaceHorizontalScroll"></div>');
                periodSpaceSheetWidth = $('<div class="content-width-wrapper"></div>').appendTo(periodSpaceHorizontalScroll);

                periodSpaceHorizontalScroll.scroll(function () {
                    periodSpaceSheet[0].scrollLeft = this.scrollLeft;
                });

                periodSpaceSheet.scroll(function () {
                    periodSpaceHorizontalScroll[0].scrollLeft = this.scrollLeft;
                });
                $('#ganttControl_mainContainer').append(periodSpaceHorizontalScroll);
            }

            redraw();
        };
    };

    //Prototype
    $dyn.controls.HiGHPlanBoard.prototype = $dyn.extendPrototype($dyn.ui.Control.prototype, {
    });

})();
