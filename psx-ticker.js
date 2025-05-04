(function () {
    const metaCharset = document.createElement('meta');
    metaCharset.setAttribute('charset', 'UTF-8');
    document.head.insertBefore(metaCharset, document.head.firstChild);

    const CACHE_DURATION = 180000; // 3 min
    let cachedData = null, cacheTimestamp = 0;

    const scriptTag = document.currentScript;
    const market = scriptTag?.getAttribute('data-market') || 'KSE30';

    const container = document.createElement('div');
    Object.assign(container.style, {
        width: '100%',
        overflow: 'hidden',
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontFamily: 'Segoe UI,Tahoma,Geneva,Verdana,sans-serif',
        fontSize: '16px',
        boxSizing: 'border-box',
        padding: '6px 0 24px 0',
        position: 'relative',
        minHeight: '48px'
    });

    const tickerWrapper = document.createElement('div');
    tickerWrapper.className = 'ticker-wrapper';
    Object.assign(tickerWrapper.style, {
        width: '100%',
        overflow: 'hidden',
        position: 'relative'
    });

    const ticker = document.createElement('div');
    ticker.className = 'ticker';
    Object.assign(ticker.style, {
        display: 'inline-flex',
        whiteSpace: 'nowrap',
        willChange: 'transform',
        animation: 'none'
    });

    const styleTag = document.createElement('style');
    styleTag.textContent = `
        @keyframes scroll-left {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }

        .ticker-item {
            display: inline-block;
            margin-right: 60px;
            font-weight: 500;
            color: #222;
            flex-shrink: 0;
        }

        .ticker-symbol {
            font-weight: bold;
            margin-right: 6px;
        }

        .ticker-change {
            margin-left: 6px;
            font-weight: bold;
        }

        .ticker-up { color: #00B15D; }
        .ticker-down { color: #CD363A; }
        .ticker-neutral { color: #888; }

        .ticker-wrapper:hover .ticker {
            animation-play-state: paused;
        }

        .powered-note {
            position: absolute;
            bottom: 4px;
            right: 10px;
            font-size: 12px;
            color: #aaa;
        }

        @media (max-width: 600px) {
            .ticker-item { margin-right: 30px; font-size: 20px; }
            .ticker-symbol { font-size: 21px; }
            .ticker-change { font-size: 20px; }
            .powered-note { font-size: 14px; bottom: 5px; right: 10px; }
        }

        @media (max-width: 480px) {
            .ticker-item { margin-right: 24px; font-size: 18px; }
            .ticker-symbol { font-size: 19px; }
            .ticker-change { font-size: 18px; }
            .powered-note { font-size: 13px; bottom: 4px; right: 8px; }
        }
    `;
    document.head.appendChild(styleTag);

    tickerWrapper.appendChild(ticker);
    container.appendChild(tickerWrapper);

    const poweredNote = document.createElement('div');
    poweredNote.className = 'powered-note';
    poweredNote.innerHTML = `Source: PSX, <a href="https://ripeinsight.com" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;">Powered by RipeInsight</a>`;
    container.appendChild(poweredNote);

    if (scriptTag?.parentNode) {
        scriptTag.parentNode.insertBefore(container, scriptTag);
    } else {
        document.body.appendChild(container);
    }

    function renderTicker(stocks) {
        console.log('Rendering ticker with', stocks.length, 'stocks');

        if (!stocks.length) {
            ticker.innerHTML = `<span style="color:#888;padding-left:10px;">No data available for ${market}</span>`;
            ticker.style.animation = 'none';
            return;
        }

        const tickerContent = stocks.map(stock => {
            const change = parseFloat(stock.change_percent) || 0;
            const changeClass = change > 0 ? 'ticker-up' : change < 0 ? 'ticker-down' : 'ticker-neutral';
            const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '−';
            return `
                <div class="ticker-item" title="${stock.symbol}: Current ${Number(stock.current).toFixed(2)}, Change ${change.toFixed(2)}%">
                    <span class="ticker-symbol">${stock.symbol}</span>
                    <span>${Number(stock.current).toFixed(2)}</span>
                    <span class="ticker-change ${changeClass}">(${arrow} ${change.toFixed(2)}%)</span>
                </div>
            `;
        }).join('');

        ticker.innerHTML = tickerContent + tickerContent; // Duplicate for smooth loop
        ticker.style.animation = 'none';

        requestAnimationFrame(() => {
            const totalScrollWidth = ticker.scrollWidth / 2;
            const pixelsPerSecond = 100; // Adjust for speed: lower = slower
            const duration = totalScrollWidth / pixelsPerSecond;

            ticker.style.animation = `scroll-left ${duration}s linear infinite`;
        });
    }

    async function fetchDataAndRender() {
        const now = Date.now();

        if (cachedData && now - cacheTimestamp < CACHE_DURATION) {
            console.log('Using cached data.');
            renderTicker(cachedData);
            return;
        }

        console.log(`Fetching data for ${market}...`);
        ticker.innerHTML = `<span style="color:#888;padding-left:10px;">Loading ${market}...</span>`;
        ticker.style.animation = 'none';

        try {
            const res = await fetch(`https://api.ripeinsight.com/psx/v1/intraday_market_watch/${market}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { entry: stocks = [] } = await res.json();
            cachedData = stocks;
            cacheTimestamp = now;
            renderTicker(stocks);
        } catch (err) {
            console.error('Ticker fetch error:', err);
            ticker.innerHTML = `<span style="color:red;padding-left:10px;">Error loading data: ${err.message}</span>`;
            ticker.style.animation = 'none';
        }
    }

    fetchDataAndRender();
})();
