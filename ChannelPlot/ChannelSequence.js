﻿define(["jquery", "DQX/DocEl", "DQX/Msg", "DQX/ChannelPlot/ChannelCanvas", "DQX/DataFetcher/DataFetcherSummary"],
    function ($, DocEl, Msg, ChannelCanvas, DataFetcherSummary) {
        var ChannelSequence = {};

        ///////////////////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////
        // ChannelPlotChannelSequence: derives from ChannelPlotChannel, and plots a horizontal scale
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////

        ChannelSequence.Channel = function (serverurl,iFolder, iConfig) {
            var that = ChannelCanvas.Base("Sequence");
            that._height = 16;
            that.myFolder = iFolder;
            that.myConfig = iConfig;
            //that.canHide = false;
            that.myTitle = 'Sequence';


            that.myfetcher = new DataFetcherSummary.Fetcher(serverurl, 1, 1200);
            //that.myfetcher.maxBlockSize = 1;
            that.mycol = that.myfetcher.addFetchColumn(that.myFolder, that.myConfig, "Base_avg", DQX.Color(1, 0, 0));
            that.myfetcher.activateFetchColumn(that.mycol.myID);

            that.setPlotter = function (thePlotter) {
                thePlotter.addDataFetcher(this.myfetcher);
            }

            that.draw = function (drawInfo, args) {
                var PosMin = Math.round((-50 + drawInfo.offsetX) / drawInfo.zoomFactX);
                var PosMax = Math.round((drawInfo.sizeCenterX + 50 + drawInfo.offsetX) / drawInfo.zoomFactX);
                this.drawStandardGradientCenter(drawInfo, 0.85);
                this.drawStandardGradientLeft(drawInfo, 0.85);

                var alldataready = true;
                var fetcherror = false;
                if (!that.myfetcher.IsDataReady(PosMin, PosMax, false))
                    alldataready = false;
                if (that.myfetcher.hasFetchFailed)
                    fetcherror = true;

                var points = this.myfetcher.getColumnPoints(PosMin, PosMax, this.mycol.myID);
                var xvals = points.xVals;
                var yvals = points.YVals;

                var blockwidth = (xvals[xvals.length - 1] - xvals[0]) * drawInfo.zoomFactX / (xvals.length);

                var colors = {
                    a: 'rgb(255,50,50)',
                    t: 'rgb(255,170,0)',
                    c: 'rgb(0,128,192)',
                    g: 'rgb(0,192,120)'
                }

                if (xvals.length > 3000)
                    return;

                var h = 16;
                if (('extraInfo' in points) && (points.extraInfo.blockSize > 1)) {
                    drawInfo.centerContext.fillStyle = 'rgb(128,128,128)';
                    drawInfo.centerContext.fillRect(0, 10, drawInfo.sizeCenterX, 6);
                    h = 10;
                }

                //drawInfo.centerContext.fillStyle = 'rgb(128,128,128)';
                //drawInfo.centerContext.fillRect(0, 0, drawInfo.sizeCenterX, h);


                if (blockwidth <= 2) {
                    for (var basenr = 0; basenr < 4; basenr++) {
                        var base = ['a', 'c', 'g', 't'][basenr];
                        drawInfo.centerContext.strokeStyle = colors[base];
                        drawInfo.centerContext.beginPath();
                        for (i = 0; i < xvals.length - 1; i++) {
                            if (yvals[i] == base) {
                                var psx1 = xvals[i] * drawInfo.zoomFactX - drawInfo.offsetX;
                                var psx2 = xvals[i + 1] * drawInfo.zoomFactX - drawInfo.offsetX;
                                drawInfo.centerContext.moveTo(psx1, 0);
                                drawInfo.centerContext.lineTo(psx1, 0 + h);
                                if (psx2 > psx1 + 1) {
                                    drawInfo.centerContext.moveTo(psx1 + 1, 0);
                                    drawInfo.centerContext.lineTo(psx1 + 1, 0 + h);
                                }
                            }
                        }
                        drawInfo.centerContext.stroke();
                    }
                }
                else {
                    for (i = 0; i < xvals.length - 1; i++) {
                        var base = yvals[i];
                        var psx1 = xvals[i] * drawInfo.zoomFactX - drawInfo.offsetX;
                        var psx2 = xvals[i + 1] * drawInfo.zoomFactX - drawInfo.offsetX;
                        var ofs = 0;
                        drawInfo.centerContext.fillStyle = colors[base];
                        drawInfo.centerContext.fillRect(psx1, 0, psx2 - psx1 + 1, h);
                    }
                }


                if (!alldataready) {
                    drawInfo.centerContext.fillStyle = "rgb(0,192,0)";
                    drawInfo.centerContext.font = '25px sans-serif';
                    drawInfo.centerContext.textBaseline = 'bottom';
                    drawInfo.centerContext.textAlign = 'center';
                    drawInfo.centerContext.fillText("Fetching data...", drawInfo.sizeX / 2, drawInfo.PosY - drawInfo.sizeY + 30);
                }
                if (fetcherror) {
                    drawInfo.centerContext.fillStyle = "rgb(255,0,0)";
                    drawInfo.centerContext.font = '25px sans-serif';
                    drawInfo.centerContext.textBaseline = 'bottom';
                    drawInfo.centerContext.textAlign = 'center';
                    drawInfo.centerContext.fillText("Fetch failed!", drawInfo.sizeX / 2, drawInfo.PosY - drawInfo.sizeY + 60);
                }


            }
            return that;
        }

        return ChannelSequence;
    });