function drawLineChart() {
    var container = d3.select("#lineChart");
    container.selectAll("*").remove();

    var margin = {top: 30, right: 40, bottom: 70, left: 80};
    var width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    var height = 480 - margin.top - margin.bottom;

    var svg = container.append("svg")
        .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var groups = currentLineGroup === 'location' 
        ? ["All Regions", "Major Cities of Australia", "Inner Regional Australia", "Outer Regional Australia", "Remote Australia", "Very Remote Australia"]
        : ["0-16", "17-25", "26-39", "40-64", "65 and over"];

    var yearFilteredData = filterByYear(fineGrainedData, yearSelections.line);
    
    if (yearSelections.line === 'All') {
        var aggMap = {};
        yearFilteredData.forEach(function(d) {
            var key = d.loc + '|' + d.age + '|' + d.metric;
            if (!aggMap[key]) {
                aggMap[key] = { loc: d.loc, age: d.age, metric: d.metric, fines: 0, arrests: 0, charges: 0 };
            }
            aggMap[key].fines += d.fines;
            aggMap[key].arrests += d.arrests;
            aggMap[key].charges += d.charges;
        });
        yearFilteredData = Object.values(aggMap);
    }
    
    var data = groups.map(function(g) {
        var items = currentLineGroup === 'location'
            ? yearFilteredData.filter(function(d) { return d.loc === g; })
            : yearFilteredData.filter(function(d) { return d.age === g && d.loc === "All Regions"; });
        return {
            name: g.replace(" of Australia", "").replace(" Australia", "").replace(" and over", "+"),
            fines: d3.sum(items, function(d) { return d.fines; }),
            arrests: d3.sum(items, function(d) { return d.arrests; }),
            charges: d3.sum(items, function(d) { return d.charges; })
        };
    }).filter(function(d) { return d.fines > 0 || d.arrests > 0; });

    var x = d3.scalePoint()
        .domain(data.map(function(d) { return d.name; }))
        .range([0, width])
        .padding(0.3);

    var maxValue = d3.max(data, function(d) { return Math.max(d.fines, d.arrests, d.charges); });
    var y = d3.scaleLog()
        .domain([1, maxValue * 1.2])
        .range([height, 0]);

    var tickValues = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000]
        .filter(function(v) { return v <= maxValue * 1.2; });
    if (!tickValues.includes(1)) tickValues.unshift(1);

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").tickValues(tickValues));

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).tickSize(0))
        .selectAll("text")
        .style("font-size", "12px")
        .style("font-weight", "500")
        .attr("dy", "1.2em");

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).tickValues(tickValues).tickFormat(function(d) {
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

    var lineDefs = [
        { key: 'fines', label: 'Fines', color: '#3b82f6' },
        { key: 'arrests', label: 'Arrests', color: '#f43f5e' },
        { key: 'charges', label: 'Charges', color: '#f59e0b' }
    ];

    var lineGen = d3.line()
        .x(function(d) { return x(d.name); })
        .y(function(d) { return y(d.value); })
        .curve(d3.curveMonotoneX);

    lineDefs.forEach(function(def, defIndex) {
        var lineData = data.map(function(d) {
            return {
                name: d.name,
                value: Math.max(d[def.key], 1),
                raw: d[def.key],
                fines: d.fines,
                arrests: d.arrests,
                charges: d.charges
            };
        });

        var path = svg.append("path")
            .datum(lineData)
            .attr("class", "line-path")
            .attr("d", lineGen)
            .attr("stroke", def.color)
            .attr("fill", "none")
            .attr("stroke-width", 3)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round");

        var totalLength = path.node().getTotalLength();
        path.attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(1200)
            .delay(defIndex * 300)
            .ease(d3.easeCubicOut)
            .attr("stroke-dashoffset", 0);

        svg.selectAll(".dot-" + def.key)
            .data(lineData)
            .enter().append("circle")
            .attr("class", "dot dot-" + def.key)
            .attr("cx", function(d) { return x(d.name); })
            .attr("cy", function(d) { return y(d.value); })
            .attr("r", 0)
            .attr("fill", def.color)
            .attr("stroke", "#111827")
            .attr("stroke-width", 2)
            .attr("pointer-events", "all")
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).transition().duration(150).attr("r", 8);
                var valueStr = def.key === 'fines' ? formatCurrency(d.raw) : formatNumber(d.raw);
                showTooltip(event, 
                    '<div class="tooltip-title">' + d.name + '</div>' +
                    '<div class="tooltip-row"><span style="color:' + def.color + '">● ' + def.label + '</span><span class="tooltip-value">' + valueStr + '</span></div>'
                );
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).transition().duration(150).attr("r", 5);
                hideTooltip();
            })
            .transition()
            .duration(400)
            .delay(function(d, i) { return 1000 + defIndex * 300 + i * 80; })
            .attr("r", 5);
    });

    var legendContainer = d3.select("#lineLegend");
    legendContainer.selectAll("*").remove();
    lineDefs.forEach(function(def) {
        var item = legendContainer.append("div").attr("class", "legend-item");
        item.append("div").attr("class", "legend-color").style("background", def.color).style("border-radius", "50%").style("width", "12px").style("height", "12px");
        item.append("span").text(def.label);
    });
}
