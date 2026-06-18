function drawMonthlyChart(view) {
    view = view || 'all';
    var container = d3.select("#monthlyChart");
    container.selectAll("*").remove();

    var margin = {top: 20, right: 30, bottom: 40, left: 80};
    var width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    var height = 420 - margin.top - margin.bottom;

    var svg = container.append("svg")
        .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var data = filterByYear(monthlyData, yearSelections.monthly);
    
    if (yearSelections.monthly === 'All') {
        var monthMap = {};
        data.forEach(function(d) {
            if (!monthMap[d.month]) {
                monthMap[d.month] = { month: d.month, name: d.name, fines: 0 };
            }
            monthMap[d.month].fines += d.fines;
        });
        data = Object.values(monthMap).sort(function(a, b) { return a.month - b.month; });
    } else {
        data = data.map(function(d) { return Object.assign({}, d); });
    }
    
    var useLog = false;

    if (view === 'exclude') {
        data = data.filter(function(d) { return d.month !== 1; });
    } else if (view === 'log') {
        useLog = true;
    }

    var x = d3.scaleBand()
        .domain(data.map(function(d) { return d.name; }))
        .range([0, width])
        .padding(0.35);
        
    var y = useLog 
        ? d3.scaleLog().domain([50000, d3.max(data, function(d) { return d.fines; })]).range([height, 0])
        : d3.scaleLinear().domain([0, d3.max(data, function(d) { return d.fines; }) * 1.05]).range([height, 0]);

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(useLog ? 4 : 8));

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).tickSize(0))
        .selectAll("text")
        .style("font-size", "12px")
        .style("font-weight", "500");

    var yAxis = d3.axisLeft(y).tickFormat(function(d) {
        if (d >= 1e6) return "$" + (d/1e6).toFixed(0) + "M";
        if (d >= 1e3) return "$" + (d/1e3).toFixed(0) + "K";
        return "$" + d;
    });
    if (useLog) {
        var maxF = d3.max(data, function(d) { return d.fines; });
        var tickVals = [100000, 500000, 1000000, 5000000, 10000000, 50000000].filter(function(v) { return v <= maxF * 1.2 && v >= 50000; });
        yAxis.tickValues(tickVals);
    } else {
        yAxis.ticks(6);
    }
    svg.append("g").attr("class", "axis").call(yAxis);

    var yearTotalFines = d3.sum(data, function(d) { return d.fines; }) || 1;

    var defs = svg.append("defs");
    var gradient = defs.append("linearGradient")
        .attr("id", "barGradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.9);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#06b6d4").attr("stop-opacity", 0.4);

    var bars = svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", function(d) { return x(d.name); })
        .attr("width", x.bandwidth())
        .attr("y", height)
        .attr("height", 0)
        .attr("rx", 6)
        .attr("fill", function(d) { return d.month === 1 && view !== 'exclude' ? "url(#barGradient)" : "#3b82f6"; })
        .attr("opacity", function(d) { return d.month === 1 && view !== 'exclude' ? 1 : 0.8; });

    bars.transition()
        .duration(1000)
        .delay(function(d, i) { return i * 80; })
        .attr("y", function(d) { return y(d.fines); })
        .attr("height", function(d) { return height - y(d.fines); });

    bars.on("mouseover", function(event, d) {
        d3.select(this).attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 2);
        showTooltip(event, 
            '<div class="tooltip-title">' + d.name + (yearSelections.monthly === 'All' ? '' : ' ' + yearSelections.monthly) + '</div>' +
            '<div class="tooltip-row"><span>Fines</span><span class="tooltip-value">' + formatCurrency(d.fines) + '</span></div>' +
            '<div class="tooltip-row"><span>Share of Year</span><span class="tooltip-value">' + ((d.fines/yearTotalFines)*100).toFixed(1) + '%</span></div>'
        );
    })
    .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
    })
    .on("mouseout", function(event, d) {
        d3.select(this).attr("opacity", d.month === 1 && view !== 'exclude' ? 1 : 0.8).attr("stroke", "none");
        hideTooltip();
    });

    svg.selectAll(".label")
        .data(data)
        .enter().append("text")
        .attr("class", "label")
        .attr("x", function(d) { return x(d.name) + x.bandwidth()/2; })
        .attr("y", function(d) { return y(d.fines) - 8; })
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#9ca3af")
        .style("opacity", 0)
        .text(function(d) {
            if (d.fines >= 1e6) return "$" + (d.fines/1e6).toFixed(1) + "M";
            return "$" + (d.fines/1e3).toFixed(0) + "K";
        })
        .transition()
        .delay(function(d, i) { return 800 + i * 80; })
        .style("opacity", 1);
}
