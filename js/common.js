var tooltip = d3.select("#tooltip");
var formatNumber = d3.format(",.0f");
var formatCurrency = function(d) { return "$" + d3.format(",.0f")(d); };
var formatCompact = function(d) {
    if (d >= 1e6) return (d / 1e6).toFixed(2) + "M";
    if (d >= 1e3) return (d / 1e3).toFixed(2) + "K";
    return d.toFixed(2);
};

var monthlyData = [];
var jurisdictionData = [];
var fineGrainedData = [];
var totalsData = [];

var yearSelections = {
    monthly: 'All',
    jurisdictionFines: 'All',
    jurisdictionArrests: 'All',
    ageGroup: 'All',
    heatmap: 'All',
    line: 'All'
};

var ageSelections = {
    ageGroup: 'All'
};

var currentJurisdictionMetric = 'arrests';
var currentAgeView = 'fines';
var currentHeatmapMetric = 'speed';
var currentLineGroup = 'location';

var heatmapMetrics = {
    speed: 'speed_fines',
    mobile: 'mobile_phone_use',
    seatbelt: 'non_wearing_seatbelts',
    unlicensed: 'unlicensed_driving'
};

function loadData() {
    var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    var getField = function(row) {
        for (var i = 1; i < arguments.length; i++) {
            if (row[arguments[i]] !== undefined) return row[arguments[i]];
        }
        return undefined;
    };

    return Promise.all([
        d3.csv("data/monthly_fines.csv", function(d) {
            var year = getField(d, 'Year', 'YEAR', 'year');
            var monthValue = getField(d, 'Month', 'Month (Number)', 'month');
            var month = monthValue ? +monthValue : null;
            return {
                year: year ? +year : null,
                month: month,
                name: month && month >= 1 && month <= 12 ? monthNames[month - 1] : (getField(d, 'Month_Name') || ''),
                fines: +getField(d, 'Fines', 'Sum(FINES)', 'Sum_FINES', 'sum_fines') || 0
            };
        }),
        d3.csv("data/jurisdiction_data.csv", function(d) {
            return {
                year: getField(d, 'Year', 'YEAR', 'year') ? +getField(d, 'Year', 'YEAR', 'year') : null,
                name: getField(d, 'Jurisdiction', 'JURISDICTION', 'jurisdiction') || '',
                fines: +getField(d, 'Fines', 'Sum(FINES)', 'Sum_FINES', 'sum_fines') || 0,
                arrests: +getField(d, 'Arrests', 'Sum(ARRESTS)', 'Sum_ARRESTS', 'sum_arrests') || 0,
                charges: +getField(d, 'Charges', 'Sum(CHARGES)', 'Sum_CHARGES', 'sum_charges') || 0
            };
        }),
        d3.csv("data/fine_grained_data.csv", function(d) {
            return {
                year: getField(d, 'Year', 'YEAR', 'year') ? +getField(d, 'Year', 'YEAR', 'year') : null,
                loc: getField(d, 'Location', 'LOCATION', 'location') || '',
                age: getField(d, 'Age_Group', 'AGE_GROUP', 'age_group') || getField(d, 'Age', 'age') || '',
                metric: getField(d, 'Metric', 'METRIC', 'metric') || '',
                fines: +getField(d, 'Fines', 'Sum(FINES)', 'Sum_FINES', 'sum_fines') || 0,
                arrests: +getField(d, 'Arrests', 'Sum(ARRESTS)', 'Sum_ARRESTS', 'sum_arrests') || 0,
                charges: +getField(d, 'Charges', 'Sum(CHARGES)', 'Sum_CHARGES', 'sum_charges') || 0
            };
        }),
        d3.csv("data/totals.csv", function(d) {
            return {
                year: getField(d, 'Year', 'YEAR', 'year') ? +getField(d, 'Year', 'YEAR', 'year') : null,
                fines: +getField(d, 'Sum(FINES)', 'Sum_FINES', 'sum_fines', 'Fines') || 0,
                arrests: +getField(d, 'Sum(ARRESTS)', 'Sum_ARRESTS', 'sum_arrests', 'Arrests') || 0,
                charges: +getField(d, 'Sum(CHARGES)', 'Sum_CHARGES', 'sum_charges', 'Charges') || 0
            };
        })
    ]).then(function(results) {
        monthlyData = results[0];
        jurisdictionData = results[1];
        fineGrainedData = results[2];
        totalsData = results[3];
        return true;
    }).catch(function(err) {
        console.error("Failed to load CSV data:", err);
        return false;
    });
}

function showTooltip(event, html) {
    tooltip.html(html)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 10) + "px")
        .classed("visible", true);
}

function hideTooltip() {
    tooltip.classed("visible", false);
}

function getMetricColor(metric) {
    var colors = {
        speed_fines: "#f43f5e",
        mobile_phone_use: "#f59e0b",
        non_wearing_seatbelts: "#10b981",
        unlicensed_driving: "#3b82f6"
    };
    return colors[metric] || "#8b5cf6";
}

function getMetricLabel(metric) {
    var labels = {
        speed_fines: "Speeding",
        mobile_phone_use: "Mobile Phone",
        non_wearing_seatbelts: "No Seatbelt",
        unlicensed_driving: "Unlicensed"
    };
    return labels[metric] || metric;
}

function getYearOptions(dataset) {
    var years = new Set(dataset.filter(function(d) { return d.year != null; }).map(function(d) { return d.year; }));
    return Array.from(years).sort(function(a, b) { return a - b; });
}

function filterByYear(dataset, year) {
    if (!year || year === 'All') return dataset;
    return dataset.filter(function(d) { return d.year === +year; });
}

function getTotalsForYear(year) {
    if (!Array.isArray(totalsData) || totalsData.length === 0) return { fines: 0, arrests: 0, charges: 0 };
    if (!year || year === 'All') {
        return totalsData.reduce(function(acc, row) {
            return {
                fines: acc.fines + (row.fines || 0),
                arrests: acc.arrests + (row.arrests || 0),
                charges: acc.charges + (row.charges || 0)
            };
        }, { fines: 0, arrests: 0, charges: 0 });
    }
    var found = totalsData.find(function(row) { return row.year === +year; });
    return found || { fines: 0, arrests: 0, charges: 0 };
}

function populateYearSelectors() {
    var selectors = document.querySelectorAll('.year-selector');
    selectors.forEach(function(selector) {
        var dataset = [];
        switch (selector.dataset.chart) {
            case 'monthly':
                dataset = monthlyData;
                break;
            case 'jurisdictionFines':
            case 'jurisdictionArrests':
                dataset = jurisdictionData;
                break;
            case 'ageGroup':
            case 'heatmap':
            case 'line':
                dataset = fineGrainedData;
                break;
            default:
                dataset = [];
        }

        var years = getYearOptions(dataset);
        var chartsWithFilteredYears = ['jurisdictionArrests', 'ageGroup', 'heatmap', 'line'];
        if (chartsWithFilteredYears.includes(selector.dataset.chart)) {
            years = years.filter(function(y) { return y === 2023 || y === 2024; });
        }
        
        selector.innerHTML = '<option value="All">All Years</option>' + years.map(function(year) { return '<option value="' + year + '">' + year + '</option>'; }).join('');
        selector.value = yearSelections[selector.dataset.chart] || 'All';
    });

    var ageSelectors = document.querySelectorAll('.age-selector');
    var ageOptions = [
        {value: 'All', label: 'All Ages'},
        {value: '0-16', label: '0-16'},
        {value: '17-25', label: '17-25'},
        {value: '26-39', label: '26-39'},
        {value: '40-64', label: '40-64'},
        {value: '65 and over', label: '65 and over'}
    ];
    ageSelectors.forEach(function(sel) {
        sel.innerHTML = ageOptions.map(function(a) { return '<option value="' + a.value + '">' + a.label + '</option>'; }).join('');
        sel.value = ageSelections[sel.dataset.chart] || 'All';
    });
    
    if (!document.body.hasAttribute('data-year-listeners-attached')) {
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('year-selector')) {
                var chartType = e.target.dataset.chart;
                yearSelections[chartType] = e.target.value;
                
                if (chartType === 'monthly') drawMonthlyChart('all');
                else if (chartType === 'jurisdictionFines') drawJurisdictionFinesChart();
                else if (chartType === 'jurisdictionArrests') drawJurisdictionArrestsChart();
                else if (chartType === 'ageGroup') drawAgeGroupChart();
                else if (chartType === 'heatmap') drawHeatmapChart();
                else if (chartType === 'line') drawLineChart();
            } else if (e.target.classList.contains('age-selector')) {
                var chartType = e.target.dataset.chart;
                ageSelections[chartType] = e.target.value;
                if (chartType === 'ageGroup') drawAgeGroupChart();
            }
        });
        document.body.setAttribute('data-year-listeners-attached', 'true');
    }
}
