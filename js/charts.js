const tooltip = d3.select("#tooltip");
const formatNumber = d3.format(",.0f");
const formatCurrency = d => "$" + d3.format(",.0f")(d);
const formatCompact = d3.format("~s");

let monthlyData = [];
let jurisdictionData = [];
let fineGrainedData = [];
let totalsData = {};

let currentJurisdictionMetric = 'arrests';
let currentAgeView = 'fines';
let currentHeatmapMetric = 'speed';
let currentLineGroup = 'location';

const heatmapMetrics = {
    speed: 'speed_fines',
    mobile: 'mobile_phone_use',
    seatbelt: 'non_wearing_seatbelts',
    unlicensed: 'unlicensed_driving'
};

function loadData() {
    return Promise.all([
        d3.csv("data/monthly_fines.csv", d => ({
            month: +d.Month,
            name: d.Month_Name.substring(0, 3),
            fines: +d.Fines
        })),
        d3.csv("data/jurisdiction_data.csv", d => ({
            name: d.Jurisdiction,
            fines: +d.Fines,
            arrests: +d.Arrests,
            charges: +d.Charges
        })),
        d3.csv("data/fine_grained_data.csv", d => ({
            loc: d.Location,
            age: d.Age_Group,
            metric: d.Metric,
            fines: +d.Fines,
            arrests: +d.Arrests,
            charges: +d.Charges
        })),
        d3.csv("data/totals.csv", d => ({
            fines: +d.Sum_FINES,
            arrests: +d.Sum_ARRESTS,
            charges: +d.Sum_CHARGES
        }))
    ]).then(([monthly, jurisdiction, fineGrained, totals]) => {
        monthlyData = monthly;
        jurisdictionData = jurisdiction;
        fineGrainedData = fineGrained;
        totalsData = totals[0];
        return true;
    }).catch(err => {
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
    const colors = {
        speed_fines: "#f43f5e",
        mobile_phone_use: "#f59e0b",
        non_wearing_seatbelts: "#10b981",
        unlicensed_driving: "#3b82f6"
    };
    return colors[metric] || "#8b5cf6";
}

function getMetricLabel(metric) {
    const labels = {
        speed_fines: "Speeding",
        mobile_phone_use: "Mobile Phone",
        non_wearing_seatbelts: "No Seatbelt",
        unlicensed_driving: "Unlicensed"
    };
    return labels[metric] || metric;
}

// monthly fine chart
function drawMonthlyChart(view = 'all') {
    const container = d3.select("#monthlyChart");
    container.selectAll("*").remove();

    const margin = {top: 20, right: 30, bottom: 40, left: 80};
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let data = monthlyData.map(d => ({...d}));
    let useLog = false;

    if (view === 'exclude') {
        data = data.filter(d => d.month !== 1);
    } else if (view === 'log') {
        useLog = true;
    }

    const x = d3.scaleBand()
        .domain(data.map(d => d.name))
        .range([0, width])
        .padding(0.35);

    const y = useLog 
        ? d3.scaleLog().domain([50000, d3.max(data, d => d.fines)]).range([height, 0])
        : d3.scaleLinear().domain([0, d3.max(data, d => d.fines) * 1.05]).range([height, 0]);

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(useLog ? 4 : 8));

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(0))
        .selectAll("text")
        .style("font-size", "12px")
        .style("font-weight", "500");

    const yAxis = d3.axisLeft(y).tickFormat(d => {
        if (d >= 1e6) return "$" + (d/1e6).toFixed(0) + "M";
        if (d >= 1e3) return "$" + (d/1e3).toFixed(0) + "K";
        return "$" + d;
    });
    if (useLog) {
        const maxF = d3.max(data, d => d.fines);
        const tickVals = [100000, 500000, 1000000, 5000000, 10000000, 50000000].filter(v => v <= maxF * 1.2 && v >= 50000);
        yAxis.tickValues(tickVals);
    } else {
        yAxis.ticks(6);
    }
    svg.append("g").attr("class", "axis").call(yAxis);

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "barGradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.9);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#06b6d4").attr("stop-opacity", 0.4);

    const bars = svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.name))
        .attr("width", x.bandwidth())
        .attr("y", height)
        .attr("height", 0)
        .attr("rx", 6)
        .attr("fill", d => d.month === 1 && view !== 'exclude' ? "url(#barGradient)" : "#3b82f6")
        .attr("opacity", d => d.month === 1 && view !== 'exclude' ? 1 : 0.8);

    bars.transition()
        .duration(1000)
        .delay((d, i) => i * 80)
        .attr("y", d => y(d.fines))
        .attr("height", d => height - y(d.fines));

    bars.on("mouseover", function(event, d) {
        d3.select(this).attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 2);
        showTooltip(event, `
            <div class="tooltip-title">${d.name} 2023</div>
            <div class="tooltip-row"><span>Fines</span><span class="tooltip-value">${formatCurrency(d.fines)}</span></div>
            <div class="tooltip-row"><span>Share of Year</span><span class="tooltip-value">${((d.fines/totalsData.fines)*100).toFixed(1)}%</span></div>
        `);
    })
    .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
    })
    .on("mouseout", function() {
        d3.select(this).attr("opacity", d => d.month === 1 && view !== 'exclude' ? 1 : 0.8).attr("stroke", "none");
        hideTooltip();
    });

    svg.selectAll(".label")
        .data(data)
        .enter().append("text")
        .attr("class", "label")
        .attr("x", d => x(d.name) + x.bandwidth()/2)
        .attr("y", d => y(d.fines) - 8)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#9ca3af")
        .style("opacity", 0)
        .text(d => {
            if (d.fines >= 1e6) return "$" + (d.fines/1e6).toFixed(1) + "M";
            return "$" + (d.fines/1e3).toFixed(0) + "K";
        })
        .transition()
        .delay((d, i) => 800 + i * 80)
        .style("opacity", 1);
}

// Jurisdiction fine chart
function drawJurisdictionFinesChart() {
    const container = d3.select("#jurisdictionFinesChart");
    container.selectAll("*").remove();

    const margin = {top: 20, right: 110, bottom: 40, left: 60};
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = [...jurisdictionData].sort((a, b) => b.fines - a.fines);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.fines)])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.name))
        .range([0, height])
        .padding(0.3);

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => "$" + formatCompact(d)))
        .attr("transform", `translate(0,${height})`);

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .style("font-size", "13px")
        .style("font-weight", "600")
        .style("fill", "#e5e7eb");

    const bars = svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => y(d.name))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", 0)
        .attr("rx", 6)
        .attr("fill", d => {
            const intensity = d.fines / d3.max(data, x => x.fines);
            return d3.interpolateRgb("#1e40af", "#60a5fa")(intensity);
        });

    bars.transition()
        .duration(1000)
        .delay((d, i) => i * 100)
        .attr("width", d => x(d.fines));

    bars.on("mouseover", function(event, d) {
        d3.select(this).attr("opacity", 0.85);
        showTooltip(event, `
            <div class="tooltip-title">${d.name}</div>
            <div class="tooltip-row"><span>Fines</span><span class="tooltip-value">${formatCurrency(d.fines)}</span></div>
            <div class="tooltip-row"><span>Arrests</span><span class="tooltip-value">${d.arrests}</span></div>
            <div class="tooltip-row"><span>Charges</span><span class="tooltip-value">${d.charges}</span></div>
        `);
    })
    .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
    })
    .on("mouseout", function() {
        d3.select(this).attr("opacity", 1);
        hideTooltip();
    });

    svg.selectAll(".label")
        .data(data)
        .enter().append("text")
        .attr("x", d => x(d.fines) + 10)
        .attr("y", d => y(d.name) + y.bandwidth()/2 + 4)
        .attr("text-anchor", "start")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#9ca3af")
        .style("opacity", 0)
        .text(d => "$" + formatCompact(d.fines))
        .transition()
        .delay((d, i) => 600 + i * 100)
        .style("opacity", 1);
}

// Jurisdiction arrests/charges chart
function drawJurisdictionArrestsChart() {
    const container = d3.select("#jurisdictionArrestsChart");
    container.selectAll("*").remove();

    const margin = {top: 20, right: 110, bottom: 40, left: 60};
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = [...jurisdictionData].filter(d => d[currentJurisdictionMetric] > 0)
        .sort((a, b) => b[currentJurisdictionMetric] - a[currentJurisdictionMetric]);

    if (data.length === 0) {
        svg.append("text")
            .attr("x", width/2)
            .attr("y", height/2)
            .attr("text-anchor", "middle")
            .style("fill", "#6b7280")
            .style("font-size", "14px")
            .text("No data available for this metric");
        return;
    }

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d[currentJurisdictionMetric])])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.name))
        .range([0, height])
        .padding(0.3);

    const color = currentJurisdictionMetric === 'arrests' ? '#f43f5e' : '#f59e0b';

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(",")))
        .attr("transform", `translate(0,${height})`);

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .style("font-size", "13px")
        .style("font-weight", "600")
        .style("fill", "#e5e7eb");

    const bars = svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => y(d.name))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", 0)
        .attr("rx", 6)
        .attr("fill", color);

    bars.transition()
        .duration(800)
        .delay((d, i) => i * 100)
        .attr("width", d => x(d[currentJurisdictionMetric]));

    bars.on("mouseover", function(event, d) {
        d3.select(this).attr("opacity", 0.85);
        showTooltip(event, `
            <div class="tooltip-title">${d.name}</div>
            <div class="tooltip-row"><span>${currentJurisdictionMetric === 'arrests' ? 'Arrests' : 'Charges'}</span><span class="tooltip-value">${formatNumber(d[currentJurisdictionMetric])}</span></div>
            <div class="tooltip-row"><span>Fines</span><span class="tooltip-value">${formatCurrency(d.fines)}</span></div>
        `);
    })
    .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
    })
    .on("mouseout", function() {
        d3.select(this).attr("opacity", 1);
        hideTooltip();
    });

    svg.selectAll(".label")
        .data(data)
        .enter().append("text")
        .attr("x", d => x(d[currentJurisdictionMetric]) + 10)
        .attr("y", d => y(d.name) + y.bandwidth()/2 + 4)
        .attr("text-anchor", "start")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#9ca3af")
        .style("opacity", 0)
        .text(d => formatNumber(d[currentJurisdictionMetric]))
        .transition()
        .delay((d, i) => 500 + i * 100)
        .style("opacity", 1);
}

// age group
function drawAgeGroupChart() {
    const container = d3.select("#ageGroupChart");
    container.selectAll("*").remove();

    const margin = {top: 20, right: 20, bottom: 60, left: 70};
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const ageGroups = ["0-16", "17-25", "26-39", "40-64", "65 and over"];
    const metrics = ["speed_fines", "mobile_phone_use", "non_wearing_seatbelts", "unlicensed_driving"];

    const allRegionsData = fineGrainedData.filter(d => d.loc === "All Regions");

    const data = ageGroups.map(age => {
        const row = {age: age.replace(" and over", "+")};
        metrics.forEach(m => {
            const item = allRegionsData.find(d => d.age === age && d.metric === m);
            row[m] = item ? item[currentAgeView === 'fines' ? 'fines' : 'arrests'] : 0;
        });
        return row;
    });

    const x0 = d3.scaleBand()
        .domain(data.map(d => d.age))
        .range([0, width])
        .padding(0.2);

    const x1 = d3.scaleBand()
        .domain(metrics)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d3.max(metrics, m => d[m])) * 1.1])
        .range([height, 0]);

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(6));

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x0))
        .selectAll("text")
        .style("font-size", "12px")
        .style("font-weight", "500");

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).ticks(6).tickFormat(d => {
            if (d >= 1e6) return (d/1e6).toFixed(0) + "M";
            if (d >= 1e3) return (d/1e3).toFixed(0) + "K";
            return d;
        }));

    const ageGroup = svg.selectAll(".age-group")
        .data(data)
        .enter().append("g")
        .attr("class", "age-group")
        .attr("transform", d => `translate(${x0(d.age)},0)`);

    ageGroup.selectAll("rect")
        .data(d => metrics.map(m => ({metric: m, value: d[m], age: d.age})))
        .enter().append("rect")
        .attr("x", d => x1(d.metric))
        .attr("y", height)
        .attr("width", x1.bandwidth())
        .attr("height", 0)
        .attr("rx", 4)
        .attr("fill", d => getMetricColor(d.metric))
        .attr("opacity", 0.85)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1.5);
            showTooltip(event, `
                <div class="tooltip-title">${d.age} · ${getMetricLabel(d.metric)}</div>
                <div class="tooltip-row"><span>${currentAgeView === 'fines' ? 'Fines' : 'Arrests'}</span><span class="tooltip-value">${formatNumber(d.value)}</span></div>
            `);
        })
        .on("mousemove", event => {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.85).attr("stroke", "none");
            hideTooltip();
        })
        .transition()
        .duration(800)
        .delay((d, i) => i * 100)
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value));

    const legend = svg.append("g").attr("transform", `translate(0, ${height + 45})`);
    metrics.forEach((m, i) => {
        const g = legend.append("g").attr("transform", `translate(${i * 110}, 0)`);
        g.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", getMetricColor(m));
        g.append("text").attr("x", 18).attr("y", 10).style("font-size", "11px").style("fill", "#9ca3af").text(getMetricLabel(m));
    });
}

//heat map
function drawHeatmapChart() {
    const container = d3.select("#heatmapChart");
    container.selectAll("*").remove();

    const margin = {top: 40, right: 20, bottom: 40, left: 100};
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 360 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const locations = ["Major Cities of Australia", "Inner Regional Australia", "Outer Regional Australia", "Remote Australia", "Very Remote Australia"];
    const ageGroups = ["0-16", "17-25", "26-39", "40-64", "65 and over"];
    const metric = heatmapMetrics[currentHeatmapMetric];

    const data = [];
    locations.forEach(loc => {
        ageGroups.forEach(age => {
            const item = fineGrainedData.find(d => d.loc === loc && d.age === age && d.metric === metric);
            data.push({
                loc: loc.replace(" of Australia", "").replace(" Australia", ""),
                age: age.replace(" and over", "+"),
                value: item ? item.fines : 0
            });
        });
    });

    const x = d3.scaleBand()
        .domain(ageGroups.map(a => a.replace(" and over", "+")))
        .range([0, width])
        .padding(0.05);

    const y = d3.scaleBand()
        .domain(locations.map(l => l.replace(" of Australia", "").replace(" Australia", "")))
        .range([0, height])
        .padding(0.05);

    const maxVal = d3.max(data, d => d.value);
    const logColorScale = d3.scaleSequential(d => d3.interpolateOranges(Math.log(d + 1) / Math.log(maxVal + 1)))
        .domain([0, maxVal]);

    svg.selectAll("rect")
        .data(data)
        .enter().append("rect")
        .attr("x", d => x(d.age))
        .attr("y", d => y(d.loc))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 4)
        .attr("fill", d => d.value === 0 ? "#1f2937" : logColorScale(d.value))
        .attr("stroke", "rgba(0,0,0,0.15)")
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#fff").attr("stroke-width", 2);
            showTooltip(event, `
                <div class="tooltip-title">${d.loc} · ${d.age}</div>
                <div class="tooltip-row"><span>${getMetricLabel(metric)}</span><span class="tooltip-value">${formatCurrency(d.value)}</span></div>
            `);
        })
        .on("mousemove", event => {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "rgba(0,0,0,0.15)").attr("stroke-width", 1);
            hideTooltip();
        })
        .transition()
        .duration(600)
        .delay((d, i) => i * 15)
        .attr("fill", d => d.value === 0 ? "#1f2937" : logColorScale(d.value));

    svg.selectAll(".cell-label")
        .data(data)
        .enter().append("text")
        .attr("class", "cell-label")
        .attr("x", d => x(d.age) + x.bandwidth()/2)
        .attr("y", d => y(d.loc) + y.bandwidth()/2 + 4)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "700")
        .style("fill", "#0f172a")
        .style("text-shadow", "0 0 3px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.6)")
        .style("pointer-events", "none")
        .style("opacity", d => d.value > 0 ? 1 : 0)
        .text(d => {
            if (d.value >= 1e6) return (d.value/1e6).toFixed(1) + "M";
            if (d.value >= 1e3) return (d.value/1e3).toFixed(0) + "K";
            if (d.value > 0) return d.value;
            return "";
        });

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(0))
        .selectAll("text")
        .style("font-size", "11px")
        .style("font-weight", "500");

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .style("font-size", "11px")
        .style("font-weight", "500");
}

//line chart
function drawLineChart() {
    const container = d3.select("#lineChart");
    container.selectAll("*").remove();

    const margin = {top: 30, right: 40, bottom: 70, left: 80};
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 480 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const groups = currentLineGroup === 'location' 
        ? ["All Regions", "Major Cities of Australia", "Inner Regional Australia", "Outer Regional Australia", "Remote Australia", "Very Remote Australia"]
        : ["0-16", "17-25", "26-39", "40-64", "65 and over"];

    const data = groups.map(g => {
        const items = currentLineGroup === 'location'
            ? fineGrainedData.filter(d => d.loc === g)
            : fineGrainedData.filter(d => d.age === g && d.loc === "All Regions");
        return {
            name: g.replace(" of Australia", "").replace(" Australia", "").replace(" and over", "+"),
            fines: d3.sum(items, d => d.fines),
            arrests: d3.sum(items, d => d.arrests),
            charges: d3.sum(items, d => d.charges)
        };
    }).filter(d => d.fines > 0 || d.arrests > 0);

    const x = d3.scalePoint()
        .domain(data.map(d => d.name))
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLog()
        .domain([1, d3.max(data, d => Math.max(d.fines, d.arrests, d.charges)) * 1.2])
        .range([height, 0]);

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(6));

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(0))
        .selectAll("text")
        .style("font-size", "12px")
        .style("font-weight", "500")
        .attr("dy", "1.2em");

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).ticks(6).tickFormat(d => {
            if (d >= 1e6) return (d/1e6).toFixed(0) + "M";
            if (d >= 1e3) return (d/1e3).toFixed(0) + "K";
            return d;
        }));

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height/2)
        .attr("y", -55)
        .attr("text-anchor", "middle")
        .style("fill", "#6b7280")
        .style("font-size", "12px")
        .text("Count / Value (log scale)");

    const lineDefs = [
        { key: 'fines', label: 'Fines', color: '#3b82f6' },
        { key: 'arrests', label: 'Arrests', color: '#f43f5e' },
        { key: 'charges', label: 'Charges', color: '#f59e0b' }
    ];

    const lineGen = d3.line()
        .x(d => x(d.name))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

    lineDefs.forEach(def => {
        const lineData = data.map(d => ({ name: d.name, value: Math.max(d[def.key], 1) }));

        const areaGen = d3.area()
            .x(d => x(d.name))
            .y0(height)
            .y1(d => y(d.value))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(lineData)
            .attr("class", "area-path")
            .attr("d", areaGen)
            .attr("fill", def.color)
            .attr("opacity", 0)
            .transition()
            .duration(800)
            .delay(200)
            .attr("opacity", 0.08);

        const path = svg.append("path")
            .datum(lineData)
            .attr("class", "line-path")
            .attr("d", lineGen)
            .attr("stroke", def.color)
            .attr("fill", "none")
            .attr("stroke-width", 3)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round");

        const totalLength = path.node().getTotalLength();
        path.attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(1200)
            .delay((lineDefs.indexOf(def)) * 300)
            .ease(d3.easeCubicOut)
            .attr("stroke-dashoffset", 0);

        svg.selectAll(`.dot-${def.key}`)
            .data(lineData)
            .enter().append("circle")
            .attr("class", `dot dot-${def.key}`)
            .attr("cx", d => x(d.name))
            .attr("cy", d => y(d.value))
            .attr("r", 0)
            .attr("fill", def.color)
            .attr("stroke", "#111827")
            .attr("stroke-width", 2)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).transition().duration(150).attr("r", 8);
                const original = data.find(item => item.name === d.name);
                showTooltip(event, `
                    <div class="tooltip-title">${d.name}</div>
                    <div class="tooltip-row"><span style="color:${def.color}">● ${def.label}</span><span class="tooltip-value">${formatNumber(original[def.key])}</span></div>
                    <div class="tooltip-row"><span>Fines</span><span class="tooltip-value">${formatCurrency(original.fines)}</span></div>
                    <div class="tooltip-row"><span>Arrests</span><span class="tooltip-value">${formatNumber(original.arrests)}</span></div>
                    <div class="tooltip-row"><span>Charges</span><span class="tooltip-value">${formatNumber(original.charges)}</span></div>
                `);
            })
            .on("mousemove", event => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).transition().duration(150).attr("r", 5);
                hideTooltip();
            })
            .transition()
            .duration(400)
            .delay((d, i) => 1000 + lineDefs.indexOf(def) * 300 + i * 80)
            .attr("r", 5);
    });

    const legendContainer = d3.select("#lineLegend");
    legendContainer.selectAll("*").remove();
    lineDefs.forEach(def => {
        const item = legendContainer.append("div").attr("class", "legend-item");
        item.append("div").attr("class", "legend-color").style("background", def.color).style("border-radius", "50%").style("width", "12px").style("height", "12px");
        item.append("span").text(def.label);
    });
}

document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        drawMonthlyChart(this.dataset.view);
    });
});

document.querySelectorAll('[data-metric]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-metric]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentJurisdictionMetric = this.dataset.metric;
        drawJurisdictionArrestsChart();
    });
});

document.querySelectorAll('[data-age-view]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-age-view]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentAgeView = this.dataset.ageView;
        drawAgeGroupChart();
    });
});

document.querySelectorAll('[data-heatmap]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-heatmap]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentHeatmapMetric = this.dataset.heatmap;
        drawHeatmapChart();
    });
});

document.querySelectorAll('[data-line]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-line]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentLineGroup = this.dataset.line;
        drawLineChart();
    });
});

function initCharts() {
    drawMonthlyChart('all');
    drawJurisdictionFinesChart();
    drawJurisdictionArrestsChart();
    drawAgeGroupChart();
    drawHeatmapChart();
    drawLineChart();
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initCharts, 250);
});

//scroll animation
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.section').forEach(section => observer.observe(section));

//for the navbar scroll effect
window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
});

document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('active');
});

function formatCompactValue(value) {
    if (value >= 1e6) {
        return (value / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (value >= 1e3) {
        return (value / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return value.toString();
}

function animateCounters() {
    document.querySelectorAll('.stat-value').forEach(el => {
        const target = +el.getAttribute('data-target');
        const duration = 2000;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = formatCompactValue(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    });
}

const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            heroObserver.disconnect();
        }
    });
}, { threshold: 0.5 });

loadData().then(success => {
    if (success) {
        document.querySelector('.stat-value[data-target="63458809"]').setAttribute('data-target', totalsData.fines);
        document.querySelector('.stat-value[data-target="9184"]').setAttribute('data-target', totalsData.arrests);
        document.querySelector('.stat-value[data-target="122732"]').setAttribute('data-target', totalsData.charges);

        initCharts();
        heroObserver.observe(document.querySelector('.hero'));
    } else {
        document.querySelector('.hero-content').innerHTML += '<p style="color:#f43f5e;margin-top:2rem;">Error loading data. Please check that CSV files are in the data/ folder.</p>';
    }
});
