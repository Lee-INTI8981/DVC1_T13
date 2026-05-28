const tooltip = d3.select("#tooltip");
const formatNumber = d3.format(",.0f");
const formatCurrency = d => "$" + d3.format(",.0f")(d);

let monthlyData = [];
let totalsData = {};

function loadData() {
    return Promise.all([
        d3.csv("data/monthly_fines.csv", d => ({
            month: +d.Month,
            name: d.Month_Name.substring(0, 3),
            fines: +d.Fines
        })),
        d3.csv("data/totals.csv", d => ({
            fines: +d.Sum_FINES,
            arrests: +d.Sum_ARRESTS,
            charges: +d.Sum_CHARGES
        }))
    ]).then(([monthly, totals]) => {
        monthlyData = monthly;
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

document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        drawMonthlyChart(this.dataset.view);
    });
});

function initCharts() {
    drawMonthlyChart('all');
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


loadData().then(success => {
    if (success) {
        initCharts();
    } else {
        document.querySelector('.hero-content').innerHTML += '<p style="color:#f43f5e;margin-top:2rem;">Error loading data. Please check that CSV files are in the data/ folder.</p>';
    }
});
