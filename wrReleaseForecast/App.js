Ext.define('Rally.example.BurnCalculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',
    config: {
        completedScheduleStateNames: ['Accepted']
    },
    constructor: function(config) {
        this.initConfig(config);
        this.callParent(arguments);
    },

    getDerivedFieldsOnInput: function() {
        var completedScheduleStateNames = this.getCompletedScheduleStateNames();
        var totalBackLogStateNames = ['Backlog', 'Defined', 'In Progress', 'Complete', 'Accepted'];

        return [
            // {
            //     "as": "Planned",
            //     "f": function(snapshot) {
            //         if (snapshot.PlanEstimate) {
            //             return snapshot.PlanEstimate;
            //         }

            //         return 0;
            //     }
            // },
            // {
            //         "as": "RemainingPoints",
            //         "f": function (snapshot) {
            //             var ss = snapshot.ScheduleState;
            //             if(completedScheduleStateNames.indexOf(ss) < 0) {
            //                 if (snapshot.PlanEstimate) {
            //                     return snapshot.PlanEstimate;
            //                 }
            //             }

            //             return 0;
            //         }
            // },
            {
                "as": "AcceptedPoints",
                "f": function (snapshot) {
                    var ss = snapshot.ScheduleState;
                    if (completedScheduleStateNames.indexOf(ss) > -1) {
                        // if (aggregationType === "storycount") {
                        //     return 1;
                        // } else 
                        if (snapshot.PlanEstimate) {
                            return snapshot.PlanEstimate;
                        }
                    }

                    return 0;
                }
            },
            {
                // Sum of Backlog, Defined, In Progress, Accepted
                "as": "TotalBacklog",
                "f": function (snapshot) {
                    var ss = snapshot.ScheduleState;
                    if (totalBackLogStateNames.indexOf(ss) > -1) {
                        // if (aggregationType === "storycount") {
                        //     return 1;
                        // } else 
                        if (snapshot.PlanEstimate) {
                            return snapshot.PlanEstimate;
                        }
                    }

                    return 0;
                }
            }
        ];
    },

    getMetrics: function() {
        return [
            // {
            //     "field": "Planned",
            //     "as": "Planned",
            //     "display": "line",
            //     "f": "sum"
            // },
            // {
            //         "field": "RemainingPoints",
            //         "as": "To Do",
            //         "f": "sum",
            //         "display": "line"

            // },
            {
                "field": "AcceptedPoints",
                "as": "Accepted",
                "f": "sum",
                "display": "line"
            },
            {
                "field": "TotalBacklog",
                "as": "Total Backlog",
                "f": "sum",
                "display": "line"
            }            
        ];
    },

    getSummaryMetricsConfig: function () {
        return [
            {
                'as': 'Scope_max',
                'f': function(seriesData) {
                        var max = 0, i = 0;
                        for (i=0;i<seriesData.length;i++) {
                            if(seriesData[i].Accepted + seriesData[i]['Total Backlog'] > max) {
                                max = seriesData[i].Accepted + seriesData[i]['Total Backlog'];
                            }
                        }
                        return max;
                     }
            }
        ];
    },
    getDerivedFieldsAfterSummary: function () {
        return  [
            // {
            //     "as": "Ideal",
            //     "f": function (row, index, summaryMetrics, seriesData) {
            //         debugger;

            //         var max = summaryMetrics.Scope_max,
            //             increments = seriesData.length - 1,
            //             incrementAmount;
            //         if(increments === 0) {
            //             return max;
            //         }
            //         incrementAmount = max / increments;
            //         return Math.floor(100 * (max - index * incrementAmount)) / 100;
            //     },
            //     "display": "line"
            // },
            {
                "as": "Accepted Prediction",
                "f": function (row, index, summaryMetrics, seriesData) {
                    // debugger;
                    return null;
                },
                "display": "line",
                "dashStyle": "Dash"
            },
            {
                "as": "Total Backlog Prediction",
                "f": function (row, index, summaryMetrics, seriesData) {
                    return null;
                },
                "display": "line",
                "dashStyle": "Dash"
            }            
        ];
    },

    getProjectionsConfig: function () {
        // debugger;
        var days = (this.scopeEndDate.getTime() -
            Rally.util.DateTime.fromIsoString(this.startDate).getTime()) / (24*1000*60*60);
        var doubleTimeboxEnd = Ext.Date.add(Rally.util.DateTime.fromIsoString(this.startDate), Ext.Date.DAY, (Math.floor(days) * 2) - 1);
        var timeboxEnd = Ext.Date.add(this.scopeEndDate, Ext.Date.DAY, -1);
        if(this.projectionsConfig === undefined) {
            this.projectionsConfig = {
                doubleTimeboxEnd: doubleTimeboxEnd,
                timeboxEnd: timeboxEnd,

                series: [
                    {
                        "as": "Accepted Prediction",
                        "field": "Accepted"
                    },
                    {
                        "as": "Total Backlog Prediction",
                        "field": "Total Backlog"
                        // "slope": 0,
                    }
                ],
                continueWhile: function (point) {
                    var dt = Rally.util.DateTime.fromIsoString(point.tick);
                    var end = (this.series[0].slope >= 0) ? this.timeboxEnd : this.doubleTimeboxEnd;
                    return dt < end;

                }
            };
        }
        return this.projectionsConfig;
    },

    _firstNonZero: function(data) {
         var i;
         for(i=0;i<data.length;i++) {
            if(data[i] > 0) {
                return i;
            }
         }
         return 0;
    },

    _leastSquares: function(todoValues, firstIndex, lastIndex) {
        var n = (lastIndex + 1) - firstIndex;
        var i;
        var sumx = 0.0, sumx2 = 0.0, sumy = 0.0, sumy2 = 0.0, sumxy = 0.0;
        var slope, yintercept;

        //Compute sums of x, x^2, y, y^2, and xy
        for (i = firstIndex; i <= lastIndex; i++) {
            sumx  = sumx  + i;
            sumx2 = sumx2 + i * i;
            sumy  = sumy  + todoValues[i];
            sumy2 = sumy2 + todoValues[i] * todoValues[i];
            sumxy = sumxy + i * todoValues[i];
        }
        slope = (n * sumxy - sumx * sumy) / (n * sumx2 - sumx * sumx);
        yintercept = (sumy * sumx2 - sumx * sumxy) / (n * sumx2 - sumx * sumx);

        return {slope: slope, yintercept: yintercept};
    },

    // runCalculation: function (snapshots) {
    //     var chartData = this.callParent(arguments);
    //     // debugger;
    //     if(chartData && chartData.projections && chartData.projections.series[0].slope > 0) {
    //     // if the slope is positive, try using least squares.  If that's also positive, then use the first result
    //         var todoData = chartData.series[0].data;
    //         var firstTodoIndex = this._firstNonZero(todoData),
    //             lastTodoIndex = (todoData.length - 1) - chartData.projections.pointsAddedCount;

    //         var results = this._leastSquares(todoData, firstTodoIndex, lastTodoIndex);

    //         // override the prediction line only if least squares says the slope isn't positive
    //         if(results.slope <= 0) {
    //             this.projectionsConfig.series[0].slope = results.slope;

    //             chartData = this.callParent(arguments);

    //             // project the plot back to the first todo value
    //             chartData.series[3].data[firstTodoIndex] = ((results.slope * firstTodoIndex) + results.yintercept) + (chartData.series[3].data[lastTodoIndex] - ((results.slope * lastTodoIndex) + results.yintercept));
    //             chartData.series[3].connectNulls = true;
    //             this.projectionsConfig = undefined;
    //         } else {
    //         // DE18732, if the slope is up, truncate it at 1.25 of the max Ideal
    //             var predictionCeiling = 1.25 * chartData.series[2].data[0];
    //             if (_.max(chartData.series[3].data) > predictionCeiling) {
    //                 var i;
    //                 var maxVal = predictionCeiling;
    //                 for(i=0;i < chartData.series[3].data.length;i++) {
    //                     if(chartData.series[3].data[i] > predictionCeiling) {
    //                         chartData.series[3].data[i] = maxVal;
    //                         maxVal = null;
    //                     }
    //                 }
    //             }
    //         }

    //     }

    //     if(new Date() < this.scopeEndDate) {
    //         // debugger;
    //         this._recomputeIdeal(chartData, this.scopeEndDate);
    //     }

    //     return chartData;
    // },

    // _recomputeIdeal: function(chartData, endDate) {
    //      var index;
    //      if(chartData.categories.length < 1) {
    //         return;
    //      }
    //      if(this.workDays.length < 1) {
    //         return;
    //      }

    //      var lastDate = Ext.Date.parse(chartData.categories[chartData.categories.length - 1], 'Y-m-d');
    //      if(endDate > lastDate) {
    //         // the scopeEndDate date wasn't found in the current categories...we need to extend categories to include it
    //         // (honoring "workDays").

    //         index = chartData.categories.length;
    //         var dt = Ext.Date.add(lastDate, Ext.Date.DAY, 1);
    //         while (dt < endDate) {
    //             while (this.workDays.indexOf(Ext.Date.format(dt, 'l')) === -1) {
    //                 dt = Ext.Date.add(dt, Ext.Date.DAY, 1);
    //             }
    //             if (dt < endDate) {
    //                 chartData.categories[index++] = Ext.Date.format(dt, 'Y-m-d');
    //             }
    //             dt = Ext.Date.add(dt, Ext.Date.DAY, 1);
    //         }
    //         index = chartData.categories.length - 1;
    //      } else {
    //          // it is in "scope"...set index to the index of the last workday in scope
    //          index = this._indexOfDate(chartData, endDate);
    //          if(index === -1) {
    //             // it's in "scope", but falls on a non-workday...back up to the previous workday
    //             while (this.workDays.indexOf(Ext.Date.format(endDate, 'l')) === -1) {
    //                 endDate = Ext.Date.add(endDate, Ext.Date.DAY, -1);
    //                 index = this._indexOfDate(chartData, endDate);
    //             }
    //          }
    //      }
    //      if(index < 0) {
    //         return;
    //      }
    //      // set first and last point, and let connectNulls fill in the rest
    //      var i;
    //      var seriesData = chartData.series[2].data;
    //      for (i=1;i<index;i++) {
    //         seriesData[i] = null;
    //      }
    //      seriesData[index] = 0;
    // },

    _indexOfDate: function(chartData, date) {
         var dateStr = Ext.Date.format(date, 'Y-m-d');
         return chartData.categories.indexOf(dateStr);
    },

    _removeFutureSeries: function (chartData, seriesIndex, dayIndex) {
        if(chartData.series[seriesIndex].data.length > dayIndex) {
            while(++dayIndex < chartData.series[seriesIndex].data.length) {
                chartData.series[seriesIndex].data[dayIndex] = null;
            }
        }
    },

    _projectionsSlopePositive: function (chartData) {
        if(chartData.projections && chartData.projections.series) {
            return chartData.projections.series[0].slope >= 0;
        }

        return true;
    }
});

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    requires: [
        'Rally.example.BurnCalculator'
    ],
    componentCls: 'app',
    items: [      // pre-define the general layout of the app; the skeleton (ie. header, content, footer)
                  {
                    xtype: 'container', // this container lets us control the layout of the pulldowns; they'll be added below
                    itemId: 'pulldown-container',
                    layout: {
                            type: 'hbox',           // 'horizontal' layout
                            align: 'stretch'
                        }
                  }
                ],
    forecastChart: undefined,      
    launch: function() {
        var me = this;
        me._loadReleases();
    },

    getSettingsFields: function () {
        return [
            {
                name: 'setting1',
                xtype: 'rallytextfield'
            }
        ];
    },

    _getAppSettings: function () {

    },
    // create and load release pulldown 
    _loadReleases: function() {
        var me = this;

        var iterComboBox = Ext.create('Rally.ui.combobox.ReleaseComboBox', {
          itemId: 'release-combobox',     // we'll use this item ID later to get the users' selection
          fieldLabel: 'Release',
          labelAlign: 'right',
          width: 300,
          listeners: {
            ready: me._createChart,      // initialization flow: next, load severities
            select: me._createChart,           // user interactivity: when they choose a value, (re)load the data
            scope: me
         }
        });

        me.down('#pulldown-container').add(iterComboBox);  // add the iteration list to the pulldown container so it lays out horiz, not the app!
     },

     _getFilters: function(releaseValue) {
       var releaseFilter = Ext.create('Rally.data.lookback.QueryFilter', {
               property: 'Release',
               operation: '=',
               value: releaseValue
       });

       var typeHierarchyFilter = Ext.create('Rally.data.lookback.QueryFilter', {
              property: '_TypeHierarchy',
              operation: '=',
              value: 'HierarchicalRequirement'
        });

       // return releaseFilter.and(typeHierarchyFilter);
       return releaseFilter;

    },    
    /**
     * Generate the store config to retrieve all snapshots for all leaf child stories of the specified PI
     */
    _getStoreConfig: function(myFilters) {
       console.log("myFilters: ", myFilters);
       console.log("context: ", this.getContext().getDataContext());

        return {
            filters: myFilters,
            fetch: ['ScheduleState', 'PlanEstimate'],
            hydrate: ['ScheduleState'],
            context: this.getContext().getDataContext(),
            autotload: true,
            limit: Infinity
        };
    },

    _createChart: function(){
        console.log("creating chart");
        var me = this;

        var releaseComboBox = this.down('#release-combobox');
        var release = releaseComboBox.getRecord();
        var endDateFieldName = releaseComboBox.getEndDateField();
        var startDateFieldName = releaseComboBox.getStartDateField();
        var selectedReleaseObjectId = release.get('ObjectID');   

        console.log("Release", release); 
        console.log("Release", release.get('PlannedVelocity'), release.get('PlannedEstimate'));
        // console.log("Realease Combo Box", releaseComboBox);
        // console.log("Release Start Date", release.get(startDateFieldName));
        // console.log("Release End Date", release.get(endDateFieldName));

        // filters to send to Rally during the store load
        var myFilters = me._getFilters(selectedReleaseObjectId);

        if(me.forecastChart){
            console.log("Chart Exists");
            // remove old chart before recreating it
            me.remove("forecastChart");
        } 
        console.log("Chart Does Not Exist");
        me.forecastChart = Ext.create('Rally.ui.chart.Chart',{
            itemId: 'forecastChart',     // we'll use this item ID later to get the users' selection
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: me._getStoreConfig(myFilters),
            calculatorType: 'Rally.example.BurnCalculator',
            calculatorConfig: {
                completedScheduleStateNames: ['Accepted'],
                enableProjections: true,
                startDate: release.get(startDateFieldName),
                scopeEndDate: release.get(endDateFieldName)
            },
            chartColors: ["#005eb8", "#8dc63f", "#666666", "#c0c0c0"],
            chartConfig: me._getChartConfig()
        });
        me.add(me.forecastChart);

    },
    /**
     * Generate a valid Highcharts configuration object to specify the chart
     */
    _getChartConfig: function() {
        return {
            chart: {
                defaultSeriesType: 'area',
                zoomType: 'xy'
            },
            title: {
                text: 'Wind River Forecast'
            },
            xAxis: {
                categories: [],
                tickmarkPlacement: 'on',
                tickInterval: 7,
                title: {
                    text: 'Date',
                    margin: 12
                },
                maxPadding: 0.25,
                labels: {
                    x: 0,
                    y: 20,
                    overflow: "justify"
                }
            },
            yAxis: [
                {
                    title: {
                        text: 'Points'
                    }
                }
            ],
            tooltip: {
                formatter: function() {
                    return '' + this.x + '<br />' + this.series.name + ': ' + this.y;
                }
            },
            plotOptions: {
                series: {
                    marker: {
                        enabled: false,
                        states: {
                            hover: {
                                enabled: true
                            }
                        }
                    },
                    connectNulls: true
                },
                column: {
                    pointPadding: 0,
                    borderWidth: 0,
                    stacking: null,
                    shadow: false
                }
            }
        };
    }
});