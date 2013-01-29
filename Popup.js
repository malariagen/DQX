﻿define([DQXSCJQ(), DQXSC("Utils"), DQXSC("DocEl"), DQXSC("Msg"), DQXSC("Controls")],
    function ($, DQX, DocEl, Msg, Controls) {
        var Popup = {};

        Popup.checkBackgroundBlockNeeded = function () {
            var blockingPopupsPresent = false;
            $('#DQXBackBlocker').find(".DQXFloatBox").each(function (index, Element) { blockingPopupsPresent = true; });
            if (!blockingPopupsPresent)
                $('#DQXBackBlocker').remove();
        }

        DQX.ClosePopup = function (index) {
            $("#" + index).remove();
            Popup.checkBackgroundBlockNeeded();
        }
        DQX._popupIndex = 0;

        DQX.SwitchPinned = function (ID) {
            var elem = $("#" + ID);
            var newStatus = !Popup.isPinned(ID);
            if (newStatus) {
                $("#" + ID).appendTo("#DQXUtilContainer");
                Popup.checkBackgroundBlockNeeded();
                elem.find('.DQXPinBoxUnpinned').remove();
                elem.find('.DQXPinBoxPinned').remove();
                elem.append(Popup.createPinBox(ID, newStatus));
            }
        }

        Popup._floatBoxMaxIndex = 99;

        Popup.makeDraggable = function (id) {
            var dragElem = $('#' + id);
            if (dragElem.length == 0)
                DQX.reportError('Draggable container not found');
            var dragHeaderElem = dragElem.find('.DQXDragHeader');
            if (dragHeaderElem.length == 0)
                DQX.reportError('Draggable container has no header element');
            var headerID = dragHeaderElem.attr('id');
            var dragOffsetX = 0;
            var dragOffsetY = 0;
            var boxW = 0;
            var boxH = 0;
            var dragOnMouseMove = function (ev) {
                var newPosX = Math.max(10, ev.pageX + dragOffsetX);
                var newPosY = Math.max(10, ev.pageY + dragOffsetY);
                newPosX = Math.min(newPosX, DQX.getWindowClientW() - boxW - 10);
                newPosY = Math.min(newPosY, DQX.getWindowClientH() - 40);
                dragElem.css({ left: newPosX, top: newPosY });
                return false;
            }
            var dragOnMouseUp = function (ev) {
                $(document).unbind('mousemove.drag', dragOnMouseMove)
                $(document).unbind('mouseup.drag', dragOnMouseUp);
                dragElem.css('opacity', 1);
                return false;
            }
            dragHeaderElem.bind('mousedown.drag', function (ev) {
                var posX = dragElem.position().left;
                var posY = dragElem.position().top;
                var mouseStartX = ev.pageX;
                var mouseStartY = ev.pageY;
                dragOffsetX = posX - mouseStartX;
                dragOffsetY = posY - mouseStartY;
                boxW = dragElem.outerWidth();
                boxH = dragElem.outerHeight();
                $(document).bind('mousemove.drag', dragOnMouseMove);
                $(document).bind('mouseup.drag', dragOnMouseUp);
                dragElem.css('opacity', 0.7);
                Popup._floatBoxMaxIndex++;
                dragElem.css('z-index', Popup._floatBoxMaxIndex);
                return false;
            });

            var touchHandler = {
                handleTouchStart: function (info, ev) {
                    var posX = dragElem.position().left;
                    var posY = dragElem.position().top;
                    var mouseStartX = info.pageX;
                    var mouseStartY = info.pageY;
                    boxW = dragElem.outerWidth();
                    boxH = dragElem.outerHeight();
                    dragOffsetX = posX - mouseStartX;
                    dragOffsetY = posY - mouseStartY;
                    dragElem.css('opacity', 0.7);
                    Popup._floatBoxMaxIndex++;
                    dragElem.css('z-index', Popup._floatBoxMaxIndex);
                },

                handleTouchMove: function (info, ev) {
                    dragOnMouseMove(info);
                },

                handleTouchStop: function () {
                    dragElem.css('opacity', 1);
                }
            }


            DQX.augmentTouchEvents(touchHandler, headerID, true, false);
        }

        Popup.isPinned = function (ID) {
            var elem = $("#" + ID);
            return elem.find('.DQXPinBoxPinned').length > 0;
        }

        Popup.createPinBox = function (ID, isPinned) {
            var bmp = isPinned ? DQXBMP('pin3.png') : DQXBMP('pin4.png');
            var thepinner = DocEl.JavaScriptBitmaplink(bmp, "Keep this info box visible", "DQX.SwitchPinned('" + ID + "')");
            thepinner.setCssClass(isPinned ? "DQXPinBoxPinned" : "DQXPinBoxUnpinned");
            thepinner.addStyle('position', 'absolute');
            thepinner.addStyle('right', '-11px');
            thepinner.addStyle('top', '-18px');
            return thepinner.toString();
        }

        Popup.createBackBlocker = function () {
            if ($('#DQXBackBlocker').length > 0)
                return;

            var background = DocEl.Div({ id: 'DQXBackBlocker' });
            background.addStyle("position", "absolute");
            background.addStyle("left", '0px');
            background.addStyle("top", '0px');
            background.addStyle('width', '100%');
            background.addStyle('height', '100%');
            var wizbackcol = 'rgba(100,100,100,0.4)';
            background.addStyle('background-color', wizbackcol);
            background.addStyle('z-index', '2000');
            $('#DQXUtilContainer').append(background.toString());

            $('#DQXBackBlocker').mousedown(function (ev) {
                if (ev.target.id == 'DQXBackBlocker') {
                    $('#DQXBackBlocker').css('background-color', 'rgba(50,50,50,0.6)');
                    setTimeout(function () {
                        $('#DQXBackBlocker').css('background-color', wizbackcol);
                        setTimeout(function () {
                            $('#DQXBackBlocker').css('background-color', 'rgba(50,50,50,0.6)');
                            setTimeout(function () {
                                $('#DQXBackBlocker').css('background-color', wizbackcol);
                            }, 150);
                        }, 150);
                    }, 150);
                    //alert("Please close the wizard if you want to return to the application");
                }
            });
        }

        Popup.create = function (title, content) {
            var wasSet = false;
            var popupID = '';
            $(".DQXFloatBox").each(function (index, Element) {
                if (!wasSet) {
                    if ($(this).find(".DQXPinBoxUnpinned").length > 0) {
                        $(this).find(".DQXFloatBoxHeader").html(title);
                        $(this).find(".DQXFloatBoxContent").html(content);
                        wasSet = true;
                        popupID = $(this).attr('id');
                    }
                }
            });
            if (wasSet) {
                return popupID;
            }
            else {
                Popup.createBackBlocker();

                var posx = DQX.mousePosX + 10;
                var posy = DQX.mousePosY + 10;
                DQX._popupIndex++;
                var ID = 'DXPopup' + DQX._popupIndex;
                var thebox = DocEl.Div({ id: ID });
                thebox.setCssClass("DQXFloatBox");
                thebox.addStyle("position", "absolute");
                thebox.addStyle("left", '0px');
                thebox.addStyle("top", '0px');

                var theheader = DocEl.Div({ id: ID + 'Handler', parent: thebox });
                theheader.setCssClass("DQXFloatBoxHeader DQXDragHeader");
                theheader.addElem(title);

                var thebody = DocEl.Div({ parent: thebox });
                thebody.setCssClass("DQXFloatBoxContent");
                thebody.addElem(content);

                var thecloser = DocEl.JavaScriptBitmaplink(DQXBMP("close2.png"), "Close", "DQX.ClosePopup('" + ID + "')");
                thebox.addElem(thecloser);
                thecloser.addStyle('position', 'absolute');
                thecloser.addStyle('left', '-17px');
                thecloser.addStyle('top', '-17px');

                thebox.addElem(Popup.createPinBox(ID, false));

                var content = thebox.toString();
                $('#DQXBackBlocker').append(content);
                Popup.makeDraggable(ID);
                var w = $('#' + ID).width();
                var h = $('#' + ID).height();
                var pageSizeX = $(window).width();
                var pageSizeY = $(window).height();
                $('#' + ID).offset({ left: (pageSizeX - w) / 2, top: (pageSizeY - h) / 2 });
            }
            return ID;
        }

        return Popup;
    });
