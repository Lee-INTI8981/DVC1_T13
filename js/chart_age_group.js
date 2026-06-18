function drawAgeGroupChart() {
    var container = d3.select("#ageGroupChart");
    container.selectAll("*").remove();

    var margin = {top: 20, right: 20, bottom: 60, left: 70};
    var width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    var height = 400 - margin.top - margin.bottom;

    var svg = container.append("svg")
        .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var ageGroups = ["0-16", "17-25", "26-39", "40-64", "65 and over"];
    var metrics = ["speed_fines", "mobile_phone_use", "non_wearing_seatbelts", "unlicensed_driving"];

    var allRegionsData = filterByYear(fineGrainedData, yearSelections.ageGroup).filter(function(d) { return d.loc === "All Regions"; });

    if (yearSelections.ageGroup === 'All') {
        var aggMap = {};
        allRegionsData.forEach(function(d) {
            var key = d.age + '|' + d.metric;
            if (!aggMap[key]) {
                aggMap[key] = { age: d.age, metric: d.metric, fines: 0, arrests: 0, charges: 0 };
            }
            aggMap[key].fines += d.fines;
            aggMap[key].arrests += d.arrests;
            aggMap[key].charges += d.charges;
        });
        allRegionsData = Object.values(aggMap);
    }

    var selectedAge = ageSelections.ageGroup || 'All';

    function drawMetricBars(metricData, titlePrefix) {
        var x = d3.scaleBand()
            .domain(metricData.map(function(d) { return d.metric; }))
            .range([0, width])
            .padding(0.25);

        var y = d3.scaleLinear()
            .domain([0, d3.max(metricData, function(d) { return d.value; }) * 1.1 || 1])
            .range([height, 0]);

        svg.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(6));

        svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x).tickFormat(function(d) { return getMetricLabel(d); }).tickSize(0))
            .selectAll("text")
            .style("font-size", "12px");

        svg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y).ticks(6).tickFormat(function(d) {
                if (d >= 1e6) return (d/1e6).toFixed(0) + "M";
                if (d >= 1e3) return (d/1e3).toFixed(0) + "K";
                return d;
            }));

        var bars = svg.selectAll('.bar-metric')
            .data(metricData)
            .enter().append('rect')
            .attr('class', 'bar-metric')
            .attr('x', function(d) { return x(d.metric); })
            .attr('y', height)
            .attr('width', x.bandwidth())
            .attr('height', 0)
            .attr('rx', 6)
            .attr('fill', function(d) { return getMetricColor(d.metric); });

        bars.transition().duration(800).attr('y', function(d) { return y(d.value); }).attr('height', function(d) { return height - y(d.value); });

        svg.selectAll('.bar-label')
            .data(metricData)
            .enter().append('text')
            .attr('class', 'bar-label')
            .attr('x', function(d) { return x(d.metric) + x.bandwidth() / 2; })
            .attr('y', height)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#e5e7eb')
            .style('font-weight', '600')
            .text(function(d) { return formatNumber(d.value); })
            .transition().duration(800)
            .attr('y', function(d) { return y(d.value) - 8; });

        bars.on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 0.9);
            showTooltip(event, 
                '<div class="tooltip-title">' + titlePrefix + ' · ' + getMetricLabel(d.metric) + '</div>' +
                '<div class="tooltip-row"><span>' + (currentAgeView === 'fines' ? 'Fines' : 'Arrests') + '</span><span class="tooltip-value">' + formatNumber(d.value) + '</span></div>'
            );
        }).on('mousemove', function(event) {
            tooltip.style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 10) + 'px');
        }).on('mouseout', function() {
            d3.select(this).attr('opacity', 1);
            hideTooltip();
        });
    }

    if (selectedAge && selectedAge !== 'All' && selectedAge !== 'All Ages') {
        var metricData = metrics.map(function(m) {
            var item = allRegionsData.find(function(d) { return d.age === selectedAge && d.metric === m; });
            return { metric: m, value: item ? item[currentAgeView === 'fines' ? 'fines' : 'arrests'] : 0 };
        });
        drawMetricBars(metricData, selectedAge);

    } else if (selectedAge === 'All Ages' || selectedAge === 'All') {
        var metricTotals = metrics.map(function(m) {
            var total = allRegionsData.reduce(function(acc, d) {
                return d.metric === m ? acc + (d[currentAgeView === 'fines' ? 'fines' : 'arrests']) : acc;
            }, 0);
            return { metric: m, value: total };
        });
        drawMetricBars(metricTotals, 'All Ages');

    } else {
        var data = ageGroups.map(function(age) {
            var row = {age: age.replace(" and over", "+")};
            metrics.forEach(function(m) {
                var item = allRegionsData.find(function(d) { return d.age === age && d.metric === m; });
                row[m] = item ? item[currentAgeView === 'fines' ? 'fines' : 'arrests'] : 0;
            });
            return row;
        });

        var x0 = d3.scaleBand()
            .domain(data.map(function(d) { return d.age; }))
            .range([0, width])
            .padding(0.2);

        var x1 = d3.scaleBand()
            .domain(metrics)
            .range([0, x0.bandwidth()])
            .padding(0.05);

        var y = d3.scaleLinear()
            .domain([0, d3.max(data, function(d) { return d3.max(metrics, function(m) { return d[m]; }); }) * 1.1])
            .range([height, 0]);

        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(6));

        svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x0))
            .selectAll("text")
            .style("font-size", "12px")
            .style("font-weight", "500");

        svg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y).ticks(6).tickFormat(function(d) {
                if (d >= 1e6) return (d/1e6).toFixed(0) + "M";
                if (d >= 1e3) return (d/1e3).toFixed(0) + "K";
                return d;
            }));

        var ageGroup = svg.selectAll(".age-group")
            .data(data)
            .enter().append("g")
            .attr("class", "age-group")
            .attr("transform", function(d) { return "translate(" + x0(d.age) + ",0)"; });

        ageGroup.selectAll("rect")
            .data(function(d) { return metrics.map(function(m) { return {metric: m, value: d[m], age: d.age}; }); })
            .enter().append("rect")
            .attr("x", function(d) { return x1(d.metric); })
            .attr("y", height)
            .attr("width", x1.bandwidth())
            .attr("height", 0)
            .attr("rx", 4)
            .attr("fill", function(d) { return getMetricColor(d.metric); })
            .attr("opacity", 0.85)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1.5);
                showTooltip(event, 
                    '<div class="tooltip-title">' + d.age + ' · ' + getMetricLabel(d.metric) + '</div>' +
                    '<div class="tooltip-row"><span>' + (currentAgeView === 'fines' ? 'Fines' : 'Arrests') + '</span><span class="tooltip-value">' + formatNumber(d.value) + '</span></div>'
                );
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 0.85).attr("stroke", "none");
                hideTooltip();
            })
            .transition()
            .duration(800)
            .delay(function(d, i) { return i * 100; })
            .attr("y", function(d) { return y(d.value); })
            .attr("height", function(d) { return height - y(d.value); });

        var legend = svg.append("g").attr("transform", "translate(0, " + (height + 45) + ")");
        metrics.forEach(function(m, i) {
            var g = legend.append("g").attr("transform", "translate(" + (i * 110) + ", 0)");
            g.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", getMetricColor(m));
            g.append("text").attr("x", 18).attr("y", 10).style("font-size", "11px").style("fill", "#9ca3af").text(getMetricLabel(m));
        });
    }
}
