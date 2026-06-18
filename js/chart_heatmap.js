function drawHeatmapChart() {
    var container = d3.select("#heatmapChart");
    container.selectAll("*").remove();

    var margin = {top: 40, right: 20, bottom: 40, left: 100};
    var width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    var height = 360 - margin.top - margin.bottom;

    var svg = container.append("svg")
        .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var locations = ["Major Cities of Australia", "Inner Regional Australia", "Outer Regional Australia", "Remote Australia", "Very Remote Australia"];
    var ageGroups = ["0-16", "17-25", "26-39", "40-64", "65 and over"];
    var metric = heatmapMetrics[currentHeatmapMetric];

    var filteredFineGrained = filterByYear(fineGrainedData, yearSelections.heatmap);
    
    if (yearSelections.heatmap === 'All') {
        var aggMap = {};
        filteredFineGrained.forEach(function(d) {
            var key = d.loc + '|' + d.age + '|' + d.metric;
            if (!aggMap[key]) {
                aggMap[key] = { loc: d.loc, age: d.age, metric: d.metric, fines: 0, arrests: 0, charges: 0 };
            }
            aggMap[key].fines += d.fines;
            aggMap[key].arrests += d.arrests;
            aggMap[key].charges += d.charges;
        });
        filteredFineGrained = Object.values(aggMap);
    }
    
    var data = [];
    locations.forEach(function(loc) {
        ageGroups.forEach(function(age) {
            var item = filteredFineGrained.find(function(d) { return d.loc === loc && d.age === age && d.metric === metric; });
            data.push({
                loc: loc.replace(" of Australia", "").replace(" Australia", ""),
                age: age.replace(" and over", "+"),
                value: item ? item.fines : 0
            });
        });
    });

    var x = d3.scaleBand()
        .domain(ageGroups.map(function(a) { return a.replace(" and over", "+"); }))
        .range([0, width])
        .padding(0.05);

    var y = d3.scaleBand()
        .domain(locations.map(function(l) { return l.replace(" of Australia", "").replace(" Australia", ""); }))
        .range([0, height])
        .padding(0.05);

    var maxVal = d3.max(data, function(d) { return d.value; });

    function getColor(value) {
        if (value === 0) return "#1f2937";
        var normalized = value / maxVal;
        var adjusted = Math.max(0.25, Math.pow(normalized, 0.35));
        return d3.interpolateYlOrRd(adjusted);
    }

    svg.selectAll("rect")
        .data(data)
        .enter().append("rect")
        .attr("x", function(d) { return x(d.age); })
        .attr("y", function(d) { return y(d.loc); })
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 4)
        .attr("fill", function(d) { return d.value === 0 ? "#1f2937" : "#1f2937"; })
        .attr("stroke", "rgba(0,0,0,0.15)")
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#fff").attr("stroke-width", 2);
            showTooltip(event, 
                '<div class="tooltip-title">' + d.loc + ' · ' + d.age + '</div>' +
                '<div class="tooltip-row"><span>' + getMetricLabel(metric) + '</span><span class="tooltip-value">' + formatCurrency(d.value) + '</span></div>'
            );
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "rgba(0,0,0,0.15)").attr("stroke-width", 1);
            hideTooltip();
        })
        .transition()
        .duration(600)
        .delay(function(d, i) { return i * 15; })
        .attr("fill", function(d) { return getColor(d.value); });

    svg.selectAll(".cell-label")
        .data(data)
        .enter().append("text")
        .attr("class", "cell-label")
        .attr("x", function(d) { return x(d.age) + x.bandwidth()/2; })
        .attr("y", function(d) { return y(d.loc) + y.bandwidth()/2 + 4; })
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "700")
        .style("fill", function(d) {
            if (d.value === 0) return "#4b5563";
            var normalized = d.value / maxVal;
            return normalized > 0.5 ? "#fff" : "#0f172a";
        })
        .style("text-shadow", function(d) {
            return d.value === 0 ? "none" : "0 0 3px rgba(255,255,255,0.5)";
        })
        .style("pointer-events", "none")
        .style("opacity", function(d) { return d.value > 0 ? 1 : 0; })
        .text(function(d) {
            if (d.value >= 1e6) return (d.value/1e6).toFixed(1) + "M";
            if (d.value >= 1e3) return (d.value/1e3).toFixed(0) + "K";
            if (d.value > 0) return d.value;
            return "";
        });

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + height + ")")
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
