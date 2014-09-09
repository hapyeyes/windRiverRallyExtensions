        Rally.onReady(function () {
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
            {
                "as": "AcceptedPoints",
                "f": function (snapshot) {
                    var ss = snapshot.ScheduleState;
                    if (completedScheduleStateNames.indexOf(ss) > -1) {
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
            {
                "as": "Accepted Prediction",
                "f": function (row, index, summaryMetrics, seriesData) {
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
            },
            {
                "as": "Forecast Velocity",
                "f": function (row, index, summaryMetrics, seriesData) {
                    return null;
                },
                "display": "line",
                "dashStyle": "Dash"                
            }
        ];
    },

    getProjectionsConfig: function () {
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

    // _leastSquares: function(todoValues, firstIndex, lastIndex) {
    //     var n = (lastIndex + 1) - firstIndex;
    //     var i;
    //     var sumx = 0.0, sumx2 = 0.0, sumy = 0.0, sumy2 = 0.0, sumxy = 0.0;
    //     var slope, yintercept;

    //     //Compute sums of x, x^2, y, y^2, and xy
    //     for (i = firstIndex; i <= lastIndex; i++) {
    //         sumx  = sumx  + i;
    //         sumx2 = sumx2 + i * i;
    //         sumy  = sumy  + todoValues[i];
    //         sumy2 = sumy2 + todoValues[i] * todoValues[i];
    //         sumxy = sumxy + i * todoValues[i];
    //     }
    //     slope = (n * sumxy - sumx * sumy) / (n * sumx2 - sumx * sumx);
    //     yintercept = (sumy * sumx2 - sumx * sumxy) / (n * sumx2 - sumx * sumx);

    //     return {slope: slope, yintercept: yintercept};
    // },

    runCalculation: function (snapshots) {
        var chartData = this.callParent(arguments);
        var forecastVelocityLineIndex = 4;
        var acceptedLineIndex = 0;
        var acceptedData;
        var forecastData;
        var i;

        // Calculate the Velocity Forecast Line
        // Take the Accepted Line Index, and add the dailyVelocity to the line
        if(chartData && this.dailyVelocity){
            console.log("runCalculation", this.dailyVelocity);
            acceptedData = chartData.series[acceptedLineIndex].data;
            forecastData = chartData.series[forecastVelocityLineIndex].data;

            var firstIndex = this._indexOfDate(chartData, this.forecastVelocityStartDate);

            if(firstIndex !== -1){
                forecastData[firstIndex] = acceptedData[firstIndex] + this.dailyVelocity;
                for (i=firstIndex+1;i<forecastData.length;i++) {
                    forecastData[i] = forecastData[i-1] + this.dailyVelocity;
                }
            }
            chartData.series[forecastVelocityLineIndex].data = forecastData;
        }
        return chartData;
    },

    _indexOfDate: function(chartData, dateStr) {
        // who knows what the date string format will be.
        // out of paranoia, let's convert it to a date object
        // then convert it back to a date str with the format we expect
        var date;

        if(dateStr === undefined){
            date = new Date();
        } else {
            date = new Date(dateStr);
        }

        dateStr = Ext.Date.format(date, 'Y-m-d');

        var index = chartData.categories.indexOf(dateStr);
        if (index === -1){
            var chartDataStartDate = new Date(chartData.categories[0]);
            while(index === -1 && date > chartDataStartDate) {
                date = Ext.Date.add(date, Ext.Date.DAY, -1);
                dateStr = Ext.Date.format(date, 'Y-m-d');
                index = chartData.categories.indexOf(dateStr);
            }
        }
        return index;
    }

    // _removeFutureSeries: function (chartData, seriesIndex, dayIndex) {
    //     if(chartData.series[seriesIndex].data.length > dayIndex) {
    //         while(++dayIndex < chartData.series[seriesIndex].data.length) {
    //             chartData.series[seriesIndex].data[dayIndex] = null;
    //         }
    //     }
    // },

    // _projectionsSlopePositive: function (chartData) {
    //     if(chartData.projections && chartData.projections.series) {
    //         return chartData.projections.series[0].slope >= 0;
    //     }

    //     return true;
    // }
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
    releaseStartDate: undefined,
    releaseEndDate: undefined,

    launch: function() {
        var me = this;
        me._loadReleases();
    },

    getSettingsFields: function () {
        return [
            {
                label: 'Forecast Velocity Start Date',
                name: 'forecastVelocityStartDate',
                xtype: 'rallydatefield'
            },
            {
                label: 'Velocity Rate',
                name: 'velocityRate',
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
            ready: me._fetchIterations,      // initialization flow: next, load severities
            select: me._fetchIterations,           // user interactivity: when they choose a value, (re)load the data
            scope: me
         }
        });

        me.down('#pulldown-container').add(iterComboBox);  // add the iteration list to the pulldown container so it lays out horiz, not the app!
     },

    _fetchIterations: function () {
        var releaseComboBox = this.down('#release-combobox');
        var release = releaseComboBox.getRecord();
        var endDateFieldName = releaseComboBox.getEndDateField();
        var startDateFieldName = releaseComboBox.getStartDateField();

        
        
        this.releaseEndDate = release.get(endDateFieldName);
        this.releaseStartDate = release.get(startDateFieldName);
        var selectedReleaseObjectId = release.get('ObjectID');   

        var store = Ext.create('Rally.data.wsapi.Store', {
            model: Ext.identityFn('Iteration'),
            filters: [
                {
                    property: 'StartDate',
                    operator: '>=',
                    value: Rally.util.DateTime.toIsoString(this.releaseStartDate, true)
                },
                {
                    property: 'EndDate',
                    operator: '<=',
                    value: Rally.util.DateTime.toIsoString(this.releaseEndDate, true)
                }
            ],
            context: {
                workspace: this.getContext().getWorkspaceRef(),
                project: this.getContext().getProjectRef()
            },
            fetch: ['Name','StartDate','EndDate', 'PlannedVelocity', 'PlanEstimate'],
            hydrate: ['PlanEstimate'],
            limit: Infinity
        });

        store.on('load', this._onIterationsLoaded, this);
        store.load();
    },

    _onIterationsLoaded: function (store) {
        this.iterations = store.getItems();
        this._getDailyVelocity();
        this._createChart();
        this.down('rallychart').on('snapshotsAggregated', this._addIterationLines, this);
    },

    _getDailyVelocity: function(){
        var dailyVelocity = 0;
        var totalVelocity = 0;
        var uniqueIterations = [];
        var unique;
        var i;
        var iterationDays = 0;
        var userEnteredVelocityRate = this.getSetting("velocityRate");

        if( userEnteredVelocityRate === undefined || userEnteredVelocityRate === ''){

            for (i = 0; i < this.iterations.length; i++) {
                unique = true;
                for (j = 0; j < uniqueIterations.length; j++) {
                    if(this._areIterationsEqual(uniqueIterations[j], this.iterations[i])) {
                        unique = false;
                        break;
                    }
                }
                // skip if end and start date are missing

                if(unique === true) {
                    uniqueIterations.push(this.iterations[i]);
                    if(this.iterations[i].PlannedVelocity !== null){
                        totalVelocity = totalVelocity + this.iterations[i].PlannedVelocity;
                        iterationDays = iterationDays + this._getIterationWorkingDays(this.iterations[i]);
                    }
                }
            }

            // TODO: HARDCODED number of days in an iteration
            // Need to calculate how many days in an iteration
            if(totalVelocity === 0){
                dailyVelocity = undefined;
            } else {
                dailyVelocity = totalVelocity/iterationDays;
                console.log("_getDailyVelocity", totalVelocity, iterationDays, dailyVelocity);
                this.dailyVelocity = dailyVelocity; 
            }

        } else {
            this.dailyVelocity = Number(this.getSetting("velocityRate"));
        }

        console.log("dailyVelocity", this.dailyVelocity);
    }, 

    _getIterationWorkingDays: function(iteration){
        var startDate = Rally.util.DateTime.fromIsoString(iteration.StartDate);
        var endDate = Rally.util.DateTime.fromIsoString(iteration.EndDate);
        var workdays = this._getWorkspaceConfiguredWorkdays();
        var date = endDate;
        var days = 0;
        if(workdays.length < 1) {
            return -1;
        }
        while (date > startDate) {
            if(workdays.indexOf(Ext.Date.format(date, 'l')) === -1)
            {
                // do nothing, its not a work day
            } else {
                days = days + 1;
            }
            date = Ext.Date.add(date, Ext.Date.DAY, -1);

        }
        return days;
    },
    _areIterationsEqual: function (iteration1, iteration2) {
        return iteration1.Name === iteration2.Name &&
               iteration1.StartDate === iteration2.StartDate &&
               iteration1.EndDate === iteration2.EndDate;
    },

    _addIterationLines: function (chart) {
        var axis = chart.chartConfig.xAxis;
        var categories = chart.chartData.categories;
        var i, j;
        var uniqueIterations = [];
        var unique;

        axis.plotLines = [];
        axis.plotBands = [];

        for (i = 0; i < this.iterations.length; i++) {
            unique = true;
            for (j = 0; j < uniqueIterations.length; j++) {
                if(this._areIterationsEqual(uniqueIterations[j], this.iterations[i])) {
                    unique = false;
                    break;
                }
            }
            // skip if end and start date are missing

            if(unique === true) {
                uniqueIterations.push(this.iterations[i]);
            }
        }

        for (i = 0; i < uniqueIterations.length; i++) {
            axis.plotLines.push(this._getPlotLine(categories, uniqueIterations[i], false));
            axis.plotBands.push(this._getPlotBand(categories, uniqueIterations[i], i % 2 !== 0));
        }

        if (uniqueIterations.length > 0) {
            axis.plotLines.push(this._getPlotLine(categories, uniqueIterations[uniqueIterations.length - 1], true));
        }

        // put in a line for today
        axis.plotLines.push(this._getTodayLine(categories));
    },

    _getWorkspaceConfiguredWorkdays: function () {
        return this.getContext().getWorkspace().WorkspaceConfiguration.WorkDays;
    },
    _getNearestWorkday: function(categories, date) {
        var dateStr = Ext.Date.format(date, 'Y-m-d');
        var index = categories.indexOf(dateStr);
        if(index === -1) {
            var workdays = this._getWorkspaceConfiguredWorkdays();
            if(workdays.length < 1) {
                return -1;
            }
            // date not in categories (probably) means it falls on a non-workday...back up to the next previous workday
            while (workdays.indexOf(Ext.Date.format(date, 'l')) === -1 && date > this.releaseStartDate) {
                date = Ext.Date.add(date, Ext.Date.DAY, -1);
                dateStr = Ext.Date.format(date, 'Y-m-d');
                index = categories.indexOf(dateStr);
            }
        }
        return index;
    },
    _getPlotBand: function (categories, iteration, shouldColorize) {
        var startDate = Rally.util.DateTime.fromIsoString(iteration.StartDate);
        var endDate = Rally.util.DateTime.fromIsoString(iteration.EndDate);

        var label =   {
                text: iteration.Name || '',
                align: 'center',
                rotation: 0,
                y: -7
        };

        return {
            color: shouldColorize ? '#F2FAFF' : '#FFFFFF',
            from: this._getNearestWorkday(categories, startDate),
            to: this._getNearestWorkday(categories, endDate) + 1,

            label: label
        };
    },
    _getPlotLine: function (categories, iteration, lastLine) {
        var dateObj;
        var dateIndex;

        if (lastLine) {
            dateObj = Rally.util.DateTime.fromIsoString(iteration.EndDate);
        } else {
            dateObj = Rally.util.DateTime.fromIsoString(iteration.StartDate);
        }

        dateIndex = this._getNearestWorkday(categories, dateObj);

        return {
            color: '#BBBBBB',
            dashStyle: 'ShortDash',
            width: 2,
            zIndex: 3,
            value: dateIndex
        };
    },

    _getTodayLine: function(categories) {
        var dateIndex;
        dateIndex = this._getNearestWorkday(categories, new Date());
        console.log("today date index", dateIndex);
        return {
            color: '#000000',
            // dashStyle: 'ShortDash',
            width: 2,
            zIndex: 3,
            value: dateIndex
        };
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
                timeZone: "GMT",
                completedScheduleStateNames: ['Accepted'],
                enableProjections: true,
                startDate: release.get(startDateFieldName),
                scopeEndDate: release.get(endDateFieldName),
                dailyVelocity: this.dailyVelocity,
                forecastVelocityStartDate: this.getSetting('forecastVelocityStartDate')
            },
            chartColors: ["#005eb8", "#8dc63f", "#666666", "#c0c0c0", "#FA58F4"],
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
                text: 'Wind River Forecast',
                margin: 30
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

            Rally.launchApp('CustomApp', {
                name:"wrReleaseBurndown",
	            parentRepos:""
            });

        });