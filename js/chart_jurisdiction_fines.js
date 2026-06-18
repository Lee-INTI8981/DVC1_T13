function drawJurisdictionFinesChart() {
    var container = d3.select("#jurisdictionFinesChart");
    container.selectAll("*").remove();

    var margin = {top: 20, right: 110, bottom: 40, left: 60};
    var width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    var height = 400 - margin.top - margin.bottom;

    var svg = container.append("svg")
        .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var data = filterByYear(jurisdictionData, yearSelections.jurisdictionFines);
    
    if (yearSelections.jurisdictionFines === 'All') {
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
    
    data = data.slice().sort(function(a, b) { return b.fines - a.fines; });

    var x = d3.scaleLinear()
        .domain([0, d3.max(data, function(d) { return d.fines; })])
        .range([0, width]);

    var y = d3.scaleBand()
        .domain(data.map(function(d) { return d.name; }))
        .range([0, height])
        .padding(0.3);

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisBottom(x).ticks(5).tickFormat(function(d) { return "$" + formatCompact(d); }))
        .attr("transform", "translate(0," + height + ")");

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .style("font-size", "13px")
        .style("font-weight", "600")
        .style("fill", "#e5e7eb");

    var maxFines = d3.max(data, function(x) { return x.fines; });
    var bars = svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("y", function(d) { return y(d.name); })
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", 0)
        .attr("rx", 6)
        .attr("fill", function(d) {
            var intensity = d.fines / maxFines;
            return d3.interpolateRgb("#1e40af", "#60a5fa")(intensity);
        });

    bars.transition()
        .duration(1000)
        .delay(function(d, i) { return i * 100; })
        .attr("width", function(d) { return x(d.fines); });

    bars.on("mouseover", function(event, d) {
        d3.select(this).attr("opacity", 0.85);
        showTooltip(event, 
            '<div class="tooltip-title">' + d.name + '</div>' +
            '<div class="tooltip-row"><span>Fines</span><span class="tooltip-value">' + formatCurrency(d.fines) + '</span></div>' +
            '<div class="tooltip-row"><span>Arrests</span><span class="tooltip-value">' + d.arrests + '</span></div>' +
            '<div class="tooltip-row"><span>Charges</span><span class="tooltip-value">' + d.charges + '</span></div>'
        );
    })
    .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
    })
    .on("mouseout", function() {
        d3.select(this).attr("opacity", 1);
        hideTooltip();
    });

    svg.selectAll(".label")
        .data(data)
        .enter().append("text")
        .attr("x", function(d) { return x(d.fines) + 10; })
        .attr("y", function(d) { return y(d.name) + y.bandwidth()/2 + 4; })
        .attr("text-anchor", "start")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#9ca3af")
        .style("opacity", 0)
        .text(function(d) { return "$" + formatCompact(d.fines); })
        .transition()
        .delay(function(d, i) { return 600 + i * 100; })
        .style("opacity", 1);
}
