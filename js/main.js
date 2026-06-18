document.querySelectorAll('[data-view]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-view]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        drawMonthlyChart(btn.dataset.view);
    });
});

document.querySelectorAll('[data-metric]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-metric]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentJurisdictionMetric = btn.dataset.metric;
        drawJurisdictionArrestsChart();
    });
});

document.querySelectorAll('[data-age-view]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-age-view]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentAgeView = btn.dataset.ageView;
        drawAgeGroupChart();
    });
});

document.querySelectorAll('[data-heatmap]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-heatmap]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentHeatmapMetric = btn.dataset.heatmap;
        drawHeatmapChart();
    });
});

document.querySelectorAll('[data-line]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-line]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentLineGroup = btn.dataset.line;
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

var resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initCharts, 250);
});

var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.section').forEach(function(section) { observer.observe(section); });

window.addEventListener('scroll', function() {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
});

document.getElementById('mobileMenuBtn').addEventListener('click', function() {
    document.getElementById('navLinks').classList.toggle('active');
});

function formatCompactValue(value) {
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
    return value.toString();
}

function animateCounters() {
    document.querySelectorAll('.stat-value').forEach(function(el) {
        var target = +el.getAttribute('data-target');
        var duration = 2000;
        var start = performance.now();

        function update(now) {
            var elapsed = now - start;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = formatCompactValue(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    });
}

var heroObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
        if (entry.isIntersecting) {
            animateCounters();
            heroObserver.disconnect();
        }
    });
}, { threshold: 0.5 });

loadData().then(function(success) {
    if (success) {
        var allTotals = getTotalsForYear('All');
        document.querySelector('.stat-value[data-target="63458809"]').setAttribute('data-target', allTotals.fines);
        document.querySelector('.stat-value[data-target="9184"]').setAttribute('data-target', allTotals.arrests);
        document.querySelector('.stat-value[data-target="122732"]').setAttribute('data-target', allTotals.charges);

        populateYearSelectors();
        initCharts();
        heroObserver.observe(document.querySelector('.hero'));
    } else {
        document.querySelector('.hero-content').innerHTML += '<p style="color:#f43f5e;margin-top:2rem;">Error loading data. Please check that CSV files are in the data/ folder.</p>';
    }
});
