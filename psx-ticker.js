/**
 * RipeInsight PSX Ticker Widget
 *
 * This script fetches live intraday market data for a specified PSX index
 * from the RipeInsight API and displays it as a scrolling ticker.
 * Elements are arranged horizontally, includes index name in a box,
 * and scrolls automatically. The "Source/Powered by" note is positioned
 * at the bottom center, *outside* the main widget box. Pause, Back,
 * and Forward buttons have been removed as requested.
 *
 * Usage: Include this script on your page. The index can be specified using
 * a 'data-market' attribute on the script tag (e.g., <script src="psx-ticker.js" data-market="KMIALL"></script>).
 * Defaults to KSE30 if not specified.
 */
(function () {
    // Ensure UTF-8 character set for proper display of symbols like ▲ and ▼
    const metaCharset = document.createElement('meta');
    metaCharset.setAttribute('charset', 'UTF-8');
    // Add charset early to avoid potential rendering issues
    if (!document.head.querySelector('meta[charset]')) {
        document.head.insertBefore(metaCharset, document.head.firstChild);
    }

    // --- Configuration ---
    const CACHE_DURATION = 180000; // 3 minutes in milliseconds
    const API_BASE_URL = 'https://api.ripeinsight.com/psx/v1/intraday_market_watch/';
    const DEFAULT_MARKET = 'KSE30';
    const SCROLL_SPEED_PPS = 100; // Pixels per second - adjust to change scroll speed
    const REFRESH_INTERVAL = 19900; // Refresh data every 1 minute (adjust as needed)

    // Map market symbols to full names (add more as needed)
    const MARKET_NAMES = {
        'KSE30': 'KSE 30 Index',
        'KSE100': 'KSE 100 Index',
        'KMIALL': 'KMI All Share Index',
        'ALLSHR': 'PSX All Share Index',
        // Add other indices here: 'SYMBOL': 'Full Name',
    };

    // --- State Variables ---
    let cachedData = null;
    let cacheTimestamp = 0;
    let fetchIntervalId = null;

    // --- Get Market Index from Script Attribute ---
    const scriptTag = document.currentScript;
    const marketSymbol = scriptTag?.getAttribute('data-market')?.toUpperCase() || DEFAULT_MARKET; // Ensure uppercase for API
    const marketName = MARKET_NAMES[marketSymbol] || `${marketSymbol} Index`; // Get full name or use symbol + " Index"

    // --- Create Widget Container ---
    const container = document.createElement('div');
    container.className = 'ripeinsight-psx-ticker'; // Add a class for easier external styling if needed
    Object.assign(container.style, {
        width: '100%',
        overflow: 'hidden',
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '16px',
        boxSizing: 'border-box',
        padding: '6px 10px', // Reset padding, footer note is outside
        position: 'relative', // Keep for wrapper hover pause
        minHeight: '50px', // Adjusted min-height
        color: '#333', // Default text color
        display: 'flex', // Use flexbox for layout
        alignItems: 'center', // Vertically align items in the row (titleArea, ticker)
        gap: '10px', // Gap between main flex items
    });

    // --- Container for Title ---
    const titleArea = document.createElement('div');
    titleArea.className = 'ticker-title-area';
    Object.assign(titleArea.style, {
        display: 'flex',
        flexDirection: 'column', // Stack children (title) vertically
        alignItems: 'flex-start', // Align title to the left
        flexShrink: 0, // Prevent shrinking
        flexGrow: 0, // Prevent growing
    });
    container.appendChild(titleArea);

    // --- Add Index Name Display (in a box) ---
    const indexTitle = document.createElement('div');
    indexTitle.className = 'ticker-index-title';
    indexTitle.textContent = marketName; // Display the full market name
    Object.assign(indexTitle.style, {
        fontWeight: 'bold',
        fontSize: '0.9em', // Slightly smaller than ticker items
        textTransform: 'uppercase',
        background: '#f0f0f0', // Light gray background for the box
        color: '#555', // Darker text color for contrast
        padding: '4px 8px', // Padding inside the box
        borderRadius: '4px', // Rounded corners for the box
        border: '1px solid #ddd', // Optional border
        lineHeight: '1.2', // Adjust line height
    });
    titleArea.appendChild(indexTitle); // Add to titleArea


    // --- Create Ticker Wrapper (for scrolling content) ---
    const tickerWrapper = document.createElement('div');
    tickerWrapper.className = 'ticker-wrapper';
    Object.assign(tickerWrapper.style, {
        overflow: 'hidden',
        position: 'relative',
        flexGrow: 1, // Allows ticker to take all available space
        flexShrink: 1, // Allows shrinking if needed
        minWidth: '50px', // Ensure ticker wrapper has a minimum width
        alignSelf: 'center', // Vertically center the ticker wrapper within the container
    });
    container.appendChild(tickerWrapper); // Add directly to container

    // --- Create Ticker (the actual scrolling content) ---
    const ticker = document.createElement('div');
    ticker.className = 'ticker';
    Object.assign(ticker.style, {
        display: 'inline-flex', // Use flex for better item spacing
        whiteSpace: 'nowrap',
        willChange: 'transform',
        animation: 'none', // Animation is set dynamically
    });
    tickerWrapper.appendChild(ticker); // Append ticker to the wrapper

    // --- Navigation Controls (Removed) ---
    // ... (Code for buttons and event listeners removed) ...

    // --- Add Powered By Note (at the bottom center, outside the main box) ---
    const footerNoteArea = document.createElement('div');
    footerNoteArea.className = 'ticker-footer-note'; // Class for styling the outer container

    const poweredNote = document.createElement('div');
    poweredNote.className = 'powered-note'; // Keep original class for text styling
    poweredNote.innerHTML = `Source: PSX, <a href="https://ripeinsight.com" target="_blank" rel="noopener noreferrer">Powered by RipeInsight</a>`;
    // No inline styles needed, using CSS classes
    footerNoteArea.appendChild(poweredNote); // Add to the new footer area

    // --- Inject Styles ---
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        @keyframes scroll-left {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }

        .ripeinsight-psx-ticker {
            /* Styles for the main ticker box */
            position: relative; /* Keep if needed for wrapper hover pause */
            padding: 6px 10px; /* Standard padding */
        }

        .ripeinsight-psx-ticker .ticker-item {
            display: inline-block;
            margin-right: 60px; /* Space between items */
            font-weight: 500;
            color: #222;
            flex-shrink: 0; /* Prevent shrinking */
            font-size: 1em; /* Inherit from container */
        }

        .ripeinsight-psx-ticker .ticker-symbol {
            font-weight: bold;
            margin-right: 6px;
            color: #000; /* Stronger color for symbol */
        }

        .ripeinsight-psx-ticker .ticker-change {
            margin-left: 6px;
            font-weight: bold;
        }

        .ripeinsight-psx-ticker .ticker-up { color: #00B15D; } /* Green */
        .ripeinsight-psx-ticker .ticker-down { color: #CD363A; } /* Red */
        .ripeinsight-psx-ticker .ticker-neutral { color: #888; } /* Gray */

        /* Hover Pause: Pause animation when mouse is over the wrapper */
        .ripeinsight-psx-ticker .ticker-wrapper:hover .ticker {
            animation-play-state: paused;
        }

        /* Styling for the footer note container *outside* the main box */
        .ticker-footer-note {
            display: block; /* Ensure it's a block element */
            width: 100%; /* Takes full width to center text */
            text-align: center; /* Centers inline content (the poweredNote div) */
            margin-top: 4px; /* Space between ticker box and note */
            box-sizing: border-box;
            padding: 0 10px; /* Add horizontal padding to prevent text touching edges */
        }

        /* Styling for the text inside the footer note */
        .powered-note {
            font-size: 11px; /* Slightly smaller font size */
            color: #888; /* Muted color */
        }

        .powered-note a {
            text-decoration: none;
            color: inherit;
        }

        .powered-note a:hover {
            text-decoration: underline;
        }


        /* Responsive Adjustments */
        @media (max-width: 768px) {
             .ripeinsight-psx-ticker { padding: 6px 8px; gap: 8px; }
             .ripeinsight-psx-ticker .ticker-item { margin-right: 40px; }
             .ripeinsight-psx-ticker .ticker-index-title { font-size: 0.85em; padding: 3px 6px; }
             .ticker-footer-note { padding: 0 8px; } /* Adjust padding */
         }

         /* On smaller screens, stack vertically */
         @media (max-width: 600px) {
              .ripeinsight-psx-ticker {
                 flexDirection: column;
                 alignItems: flex-start;
                 padding: 8px 10px;
                 gap: 8px;
             }
              .ripeinsight-psx-ticker .ticker-index-title { margin-bottom: 0; font-size: 0.9em; padding: 4px 8px; }
             /* The footer note remains block and centered */
              .ticker-footer-note {
                  margin-top: 4px; /* Keep consistent margin */
                  padding: 0 10px; /* Keep consistent padding */
             }
         }
    `;
    document.head.appendChild(styleTag);


    // --- Insert Widget into the DOM ---
    // Insert the main container before the script tag
    if (scriptTag?.parentNode) {
        scriptTag.parentNode.insertBefore(container, scriptTag);
    } else {
        document.body.appendChild(container);
    }

    // Insert the footer note area immediately after the main container
    if (container.parentNode) {
        container.parentNode.insertBefore(footerNoteArea, container.nextSibling);
    } else {
        // Fallback if container couldn't be inserted before script
        document.body.appendChild(footerNoteArea); // Appends at the very end
        console.warn("Could not insert footer note immediately after ticker container. Appending to body.");
    }


    /**
     * Renders the stock data into the ticker element.
     * @param {Array<Object>} stocks - Array of stock objects from the API.
     */
    function renderTicker(stocks) {
        console.log(`Rendering ticker for ${marketSymbol} (${marketName}) with ${stocks.length} items.`);

        // Stop any existing animation before rendering
        ticker.style.animation = 'none';
        ticker.innerHTML = ''; // Clear previous content

        if (!stocks || !stocks.length) {
            ticker.innerHTML = `<span style="color:#888;padding-left:10px;">No data available for ${marketSymbol}.</span>`;
            return;
        }

        // Generate HTML for each stock item
        const tickerContent = stocks.map(stock => {
            const currentPrice = parseFloat(stock.current);
            const changePercent = parseFloat(stock.change_percent);

            // Basic validation for data
            if (isNaN(currentPrice) || isNaN(changePercent) || !stock.symbol) {
                console.warn('Skipping item with invalid data:', stock);
                return ''; // Skip this item if data is invalid
            }

            const changeClass = changePercent > 0 ? 'ticker-up' : changePercent < 0 ? 'ticker-down' : 'ticker-neutral';
            const arrow = changePercent > 0 ? '▲' : changePercent < 0 ? '▼' : '−';
            // Show absolute change value
            const formattedChange = `${Math.abs(changePercent).toFixed(2)}`;


            return `
                <div class="ticker-item" title="${stock.symbol}: Current ${currentPrice.toFixed(2)}, Change ${changePercent.toFixed(2)}%">
                    <span class="ticker-symbol">${stock.symbol}</span>
                    <span>${currentPrice.toFixed(2)}</span>
                    <span class="ticker-change ${changeClass}">(${arrow} ${formattedChange}%)</span>
                </div>
            `;
        }).join('');

        // Duplicate content for seamless looping animation
        ticker.innerHTML = tickerContent + tickerContent;

        // Recalculate animation based on content width
        requestAnimationFrame(() => {
            // Ensure the element is in the DOM and has calculated width
            if (ticker.scrollWidth > 0) {
                // totalScrollWidth is the width of the *single* set of ticker items
                const totalScrollWidth = ticker.scrollWidth / 2;
                // animation.duration is the time to scroll exactly halfway (one full set of items)
                const duration = totalScrollWidth / SCROLL_SPEED_PPS; // Duration in seconds

                // Apply animation
                ticker.style.animation = `scroll-left ${duration}s linear infinite`;

            } else {
                // Handle case where scrollWidth is 0
                console.warn('Ticker scrollWidth is 0, animation skipped.');
                ticker.style.animation = 'none';
            }
        });
    }

    /**
     * Fetches market data from the API, handles caching, and triggers rendering.
     */
    async function fetchDataAndRender() {
        const now = Date.now();

        // Use cached data if fresh enough
        if (cachedData && now - cacheTimestamp < CACHE_DURATION) {
            console.log(`Using cached data for ${marketSymbol} (${marketName}).`);
            renderTicker(cachedData);
            return;
        }

        console.log(`Workspaceing data for ${marketSymbol} (${marketName})...`);
        // Display loading state
        ticker.innerHTML = `<span style="color:#888;padding-left:10px;">Loading ${marketName} data...</span>`;
        ticker.style.animation = 'none'; // Stop animation while loading

        try {
            const res = await fetch(`${API_BASE_URL}${marketSymbol}`);
            if (!res.ok) {
                 // Attempt to parse error body if available, fallback to status text
                 const errorBody = await res.text();
                 throw new Error(`HTTP error! Status: ${res.status}${errorBody ? ` - ${errorBody.substring(0, 100)}...` : ''}`);
            }
            const { entry: stocks = [] } = await res.json(); // Destructure and provide default empty array
            cachedData = stocks;
            cacheTimestamp = now;
            renderTicker(stocks);
        } catch (err) {
            console.error(`RipeInsight Ticker Fetch Error for ${marketSymbol} (${marketName}):`, err);
            // Display error message
            ticker.innerHTML = `<span style="color:red;padding-left:10px;">Error loading data for ${marketName}: ${err.message}</span>`;
            ticker.style.animation = 'none'; // Ensure animation is stopped on error
            cachedData = null; // Clear cache on error
        }
    }

    // --- Initial Fetch and Periodic Refresh ---
    fetchDataAndRender(); // Fetch and render immediately on load

    // Set interval to refresh data periodically
    // Clear any existing interval to avoid duplicates if the script is somehow run multiple times
    if (fetchIntervalId) {
        clearInterval(fetchIntervalId);
    }
    fetchIntervalId = setInterval(fetchDataAndRender, REFRESH_INTERVAL);


})(); // Execute the function immediately
