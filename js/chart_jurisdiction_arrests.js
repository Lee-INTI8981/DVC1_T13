function drawJurisdictionArrestsChart() {
    var container = d3.select("#jurisdictionArrestsChart");
    container.selectAll("*").remove();

    var margin = {top: 20, right: 20, bottom: 20, left: 20};
    var containerWidth = container.node().getBoundingClientRect().width;
    var width = containerWidth - margin.left - margin.right;
    var height = 400 - margin.top - margin.bottom;
    var radius = Math.min(width, height) / 2 - 10;

    var svg = container.append("svg")
        .attr("viewBox", "0 0 " + containerWidth + " " + (height + margin.top + margin.bottom))
        .append("g")
        .attr("transform", "translate(" + (margin.left + width / 2) + "," + (margin.top + height / 2) + ")");

    var data = filterByYear(jurisdictionData, yearSelections.jurisdictionArrests);
    
    if (yearSelections.jurisdictionArrests === 'All') {
        var jurisMap = {};
        data.forEach(function(d) {
            if (!jurisMap[d.name]) {
                jurisMap[d.name] = { name: d.name, fines: 0, arrests: 0, charges: 0 };
            }
            jurisMap[d.name].fines += d.fines;
            jurisMap[d.name].arrests += d.arrests;
            jurisMap[d.name].charges += d.charges;
        });
        data = Object.values(jurisMap);
    }
    
    data = data.filter(function(d) { return d[currentJurisdictionMetric] > 0; })
        .sort(function(a, b) { return b[currentJurisdictionMetric] - a[currentJurisdictionMetric]; });

    if (data.length === 0) {
        svg.append("text")
            .attr("text-anchor", "middle")
            .style("fill", "#6b7280")
            .style("font-size", "14px")
            .text("No data available for this metric");
        return;
    }

    var total = d3.sum(data, function(d) { return d[currentJurisdictionMetric]; });

    var pie = d3.pie()
        .value(function(d) { return d[currentJurisdictionMetric]; })
        .sort(null);

    var arc = d3.arc()
        .innerRadius(radius * 0.55)
        .outerRadius(radius);

    var arcHover = d3.arc()
        .innerRadius(radius * 0.55)
        .outerRadius(radius * 1.08);

    var colorScale = d3.scaleOrdinal()
        .domain(data.map(function(d) { return d.name; }))
        .range(["#f43f5e", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"]);

    var slices = svg.selectAll(".slice")
        .data(pie(data))
        .enter().append("g")
        .attr("class", "slice");

    var paths = slices.append("path")
        .attr("fill", function(d) { return colorScale(d.data.name); })
        .attr("stroke", "#1f2937")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .each(function() { this._current = { startAngle: 0, endAngle: 0 }; });

    paths.transition()
        .duration(800)
        .delay(function(d, i) { return i * 80; })
        .attrTween("d", function(d) {
            var interpolate = d3.interpolate(this._current, d);
            this._current = interpolate(0);
            return function(t) { return arc(interpolate(t)); };
        });

    paths.on("mouseover", function(event, d) {
        d3.select(this).transition().duration(200).attr("d", arcHover);
        var pct = ((d.data[currentJurisdictionMetric] / total) * 100).toFixed(1);
        showTooltip(event, 
            '<div class="tooltip-title">' + d.data.name + '</div>' +
            '<div class="tooltip-row"><span>' + (currentJurisdictionMetric === 'arrests' ? 'Arrests' : 'Charges') + '</span><span class="tooltip-value">' + formatNumber(d.data[currentJurisdictionMetric]) + '</span></div>' +
            '<div class="tooltip-row"><span>Share</span><span class="tooltip-value">' + pct + '%</span></div>' +
            '<div class="tooltip-row"><span>Fines</span><span class="tooltip-value">' + formatCurrency(d.data.fines) + '</span></div>'
        );
    })
    .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
    })
    .on("mouseout", function() {
        d3.select(this).transition().duration(200).attr("d", arc);
        hideTooltip();
    });

    var labelArc = d3.arc()
        .innerRadius(radius * 1.2)
        .outerRadius(radius * 1.2);

    var labels = slices.append("text")
        .attr("transform", function(d) {
            var pos = labelArc.centroid(d);
            return "translate(" + pos + ")";
        })
        .attr("text-anchor", function(d) {
            return (d.endAngle + d.startAngle) / 2 > Math.PI ? "end" : "start";
        })
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#e5e7eb")
        .style("opacity", 0)
        .text(function(d) {
            var pct = ((d.data[currentJurisdictionMetric] / total) * 100).toFixed(1);
            return d.data.name + " " + pct + "%";
        });

    labels.transition()
        .duration(800)
        .delay(function(d, i) { return 600 + i * 80; })
        .style("opacity", function(d) { return ((d.data[currentJurisdictionMetric] / total) * 100) > 3 ? 1 : 0; });

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.3em")
        .style("font-size", "14px")
        .style("font-weight", "700")
        .style("fill", "#f9fafb")
        .text(formatNumber(total));

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.1em")
        .style("font-size", "11px")
        .style("fill", "#9ca3af")
        .text("Total " + (currentJurisdictionMetric === 'arrests' ? 'Arrests' : 'Charges'));
}
