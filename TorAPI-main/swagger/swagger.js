/**
 * @openapi
 * tags:
 *   - name: Providers
 *     description: Operations related to checking provider status and testing
 *   - name: Category
 *     description: Operations to get category lists for providers
 *   - name: RSS
 *     description: Operations to get RSS feeds from providers
 *   - name: Search by Title
 *     description: Search torrents by title across different providers
 *   - name: Search by ID
 *     description: Get torrent details by its ID from a specific provider
 */

/**
 * @openapi
 * /api/provider/list:
 *   get:
 *     tags: [Providers]
 *     summary: Get a list of available providers
 *     description: Returns a list of supported torrent tracker providers and their known URLs.
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   Provider:
 *                     type: string
 *                     description: Name of the provider
 *                     example: RuTracker
 *                   Urls:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: url
 *                     description: List of known URLs for the provider
 *                     example: ["https://rutracker.org", "https://rutracker.net"]
 *       404:
 *         description: Endpoint not found
 */

/**
 * @openapi
 * /api/provider/check:
 *   get:
 *     tags: [Providers]
 *     summary: Check basic availability of providers
 *     description: |-
 *       Performs a quick check (usually a simple title search) to determine if each provider is reachable and returning results.
 *       **Note:** This endpoint might be removed or changed in future versions. Use `/api/provider/test` for more detailed testing.
 *     responses:
 *       200:
 *         description: Successful response indicating reachability status.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   RuTracker:
 *                     type: boolean
 *                     description: True if RuTracker seems available.
 *                   Kinozal:
 *                     type: boolean
 *                     description: True if Kinozal seems available.
 *                   RuTor:
 *                     type: boolean
 *                     description: True if RuTor seems available.
 *                   NoNameClub:
 *                     type: boolean
 *                     description: True if NoNameClub seems available.
 *                   Pornolab:
 *                     type: boolean
 *                     description: True if Pornolab seems available.
 *       404:
 *         description: Endpoint not found
 *       500:
 *         description: Error during check process
 */

/**
 * @openapi
 * /api/provider/test:
 *   get:
 *     tags: [Providers]
 *     summary: Perform detailed tests on all endpoints
 *     description: Runs a series of tests (RSS, Title Search, ID Search) for each provider using a sample query to check functionality and response structure.
 *     parameters:
 *       - name: query
 *         in: query
 *         required: false
 *         description: Optional query string to use for testing title/ID searches. Defaults to internal test values if omitted.
 *         schema:
 *           type: string
 *           example: "Test Query"
 *     responses:
 *       200:
 *         description: Successful test results. Boolean values indicate success/failure of specific checks. Runtimes are in seconds.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   RSS:
 *                     type: object
 *                     description: Status of RSS feed retrieval.
 *                     properties:
 *                       RuTracker: { type: boolean }
 *                       Kinozal: { type: boolean }
 *                       RuTor: { type: boolean }
 *                       NoNameClub: { type: boolean }
 *                       # Pornolab RSS not implemented
 *                   Title:
 *                     type: object
 *                     description: Status and performance of Title Search.
 *                     properties:
 *                       Status:
 *                         type: object
 *                         properties:
 *                           RuTracker: { type: boolean }
 *                           Kinozal: { type: boolean }
 *                           RuTor: { type: boolean }
 *                           NoNameClub: { type: boolean }
 *                           Pornolab: { type: boolean } # Added
 *                       Id:
 *                         type: object
 *                         description: First torrent ID found during title search test (null if failed).
 *                         properties:
 *                           RuTracker: { type: ['integer', 'null'] }
 *                           Kinozal: { type: ['integer', 'null'] }
 *                           RuTor: { type: ['integer', 'null'] }
 *                           NoNameClub: { type: ['integer', 'null'] }
 *                           Pornolab: { type: ['integer', 'null'] } # Added
 *                       RunTime:
 *                         type: object
 *                         description: Execution time in seconds for title search.
 *                         properties:
 *                           RuTracker: { type: number, format: float }
 *                           Kinozal: { type: number, format: float }
 *                           RuTor: { type: number, format: float }
 *                           NoNameClub: { type: number, format: float }
 *                           Pornolab: { type: number, format: float } # Added
 *                   Id:
 *                     type: object
 *                     description: Status and performance of ID Search (using ID found in Title test).
 *                     properties:
 *                       Status:
 *                         type: object
 *                         properties:
 *                           RuTracker: { type: boolean }
 *                           Kinozal: { type: boolean }
 *                           RuTor: { type: boolean }
 *                           NoNameClub: { type: boolean }
 *                           Pornolab: { type: boolean } # Added
 *                       Files:
 *                         type: object
 *                         description: Boolean indicating if the file list was successfully retrieved (and not an error message).
 *                         properties:
 *                           RuTracker: { type: boolean }
 *                           Kinozal: { type: boolean }
 *                           RuTor: { type: boolean }
 *                           NoNameClub: { type: boolean }
 *                           Pornolab: { type: boolean } # Added
 *                       RunTime:
 *                         type: object
 *                         description: Execution time in seconds for ID search.
 *                         properties:
 *                           RuTracker: { type: number, format: float }
 *                           Kinozal: { type: number, format: float }
 *                           RuTor: { type: number, format: float }
 *                           NoNameClub: { type: number, format: float }
 *                           Pornolab: { type: number, format: float } # Added
 *       400:
 *         description: Error in input parameters
 *       404:
 *         description: Endpoint not found
 *       500:
 *         description: Error during test execution
 */

// --- Category Endpoints ---
/**
 * @openapi
 * /api/get/category/rutracker:
 *   get:
 *     tags: [Category]
 *     summary: Get RuTracker categories
 *     description: Returns a static list of categories (ID to Name mapping) for RuTracker, loaded from `category.json`.
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryListResponse' # Reference shared schema
 *       404:
 *         description: Provider categories not found
 */
/**
 * @openapi
 * /api/get/category/kinozal:
 *   get:
 *     tags: [Category]
 *     summary: Get Kinozal categories
 *     description: Returns a static list of categories (ID to Name mapping) for Kinozal, loaded from `category.json`.
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryListResponse' # Reference shared schema
 *       404:
 *         description: Provider categories not found
 */
/**
 * @openapi
 * /api/get/category/rutor:
 *   get:
 *     tags: [Category]
 *     summary: Get RuTor categories
 *     description: Returns a static list of categories (ID to Name mapping) for RuTor, loaded from `category.json`.
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryListResponse' # Reference shared schema
 *       404:
 *         description: Provider categories not found
 */
/**
 * @openapi
 * /api/get/category/nonameclub:
 *   get:
 *     tags: [Category]
 *     summary: Get NoNameClub categories
 *     description: Returns a static list of categories (ID to Name mapping) for NoNameClub, loaded from `category.json`.
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryListResponse' # Reference shared schema
 *       404:
 *         description: Provider categories not found
 */
/**
 * @openapi
 * /api/get/category/pornolab:
 *   get:
 *     tags: [Category]
 *     summary: Get Pornolab categories
 *     description: Returns a static list of categories (ID to Name mapping) for Pornolab, loaded from `category.json`.
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryListResponse' # Reference shared schema
 *       404:
 *         description: Provider categories not found
 */


// --- RSS Endpoints ---
/**
 * @openapi
 * /api/get/rss/rutracker:
 *   get:
 *     tags: [RSS]
 *     summary: Get RuTracker RSS feed
 *     description: |-
 *       Get native RSS news feed from RuTracker provider.
 *       Returns XML by default, or JSON if 'Accept: application/json' header is present.
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryFilter'
 *     responses:
 *       200:
 *         description: Successful RSS response
 *         content:
 *           application/xml:
 *             schema: { type: string, format: xml }
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RssItemRuTracker'
 *       400:
 *         description: Error fetching or parsing feed
 *       404:
 *         description: Provider not found or RSS not available
 */
/**
 * @openapi
 * /api/get/rss/kinozal:
 *   get:
 *     tags: [RSS]
 *     summary: Get Kinozal Custom RSS feed
 *     description: |-
 *       Get a custom-generated RSS feed from Kinozal based on recent torrents.
 *       Returns XML by default, or JSON if 'Accept: application/json' header is present.
 *       Supports category, year, and format filtering.
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryFilterKinozal'
 *       - $ref: '#/components/parameters/YearFilter'
 *       - $ref: '#/components/parameters/FormatFilter'
 *     responses:
 *       200:
 *         description: Successful RSS response
 *         content:
 *           application/xml:
 *             schema: { type: string, format: xml }
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RssItemKinozalCustom'
 *       400:
 *         description: Error fetching or parsing feed
 *       404:
 *         description: Provider not found or RSS not available
 */
/**
 * @openapi
 * /api/get/rss/rutor:
 *   get:
 *     tags: [RSS]
 *     summary: Get RuTor Custom RSS feed
 *     description: |-
 *       Get custom-generated RSS feed from RuTor provider based on recent torrents.
 *       Returns XML by default, or JSON if 'Accept: application/json' header is present.
 *       Supports category filtering.
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryFilterRuTor'
 *     responses:
 *       200:
 *         description: Successful RSS response
 *         content:
 *           application/xml:
 *             schema: { type: string, format: xml }
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RssItemRuTorCustom'
 *       400:
 *         description: Error fetching or parsing feed
 *       404:
 *         description: Provider not found or RSS not available
 */
/**
 * @openapi
 * /api/get/rss/nonameclub:
 *   get:
 *     tags: [RSS]
 *     summary: Get NoNameClub RSS feed
 *     description: |-
 *       Get native RSS news feed from NoNameClub provider.
 *       Returns XML by default, or JSON if 'Accept: application/json' header is present.
 *       Supports category filtering.
 *     parameters:
 *       - $ref: '#/components/parameters/CategoryFilter'
 *     responses:
 *       200:
 *         description: Successful RSS response
 *         content:
 *           application/xml:
 *             schema: { type: string, format: xml }
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RssItemNoNameClub'
 *       400:
 *         description: Error fetching or parsing feed
 *       404:
 *         description: Provider not found or RSS not available
 */
// Note: No RSS endpoint defined for Pornolab in the provided code.

// --- Search by Title Endpoints ---
/**
 * @openapi
 * /api/search/title/rutracker:
 *   get:
 *     tags: [Search by Title]
 *     summary: Search RuTracker by title
 *     description: Search for torrents on RuTracker by title, with optional category filtering and pagination.
 *     parameters:
 *       - $ref: '#/components/parameters/QuerySearch'
 *       - $ref: '#/components/parameters/CategoryFilter'
 *       - $ref: '#/components/parameters/PageFilterRuTracker'
 *     responses:
 *       '200':
 *         description: Successful response with search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentSearchResultRuTracker'
 *       400:
 *         description: Invalid parameters or no results found
 *       404:
 *         description: Provider not found
 *       503:
 *         description: Service unavailable (tracker unreachable or error during parsing)
 */
/**
 * @openapi
 * /api/search/title/kinozal:
 *   get:
 *     tags: [Search by Title]
 *     summary: Search Kinozal by title
 *     description: Search for torrents on Kinozal by title, with optional category, year, format filtering and pagination.
 *     parameters:
 *       - $ref: '#/components/parameters/QuerySearch'
 *       - $ref: '#/components/parameters/CategoryFilterKinozal'
 *       - $ref: '#/components/parameters/PageFilterKinozal'
 *       - $ref: '#/components/parameters/YearFilter'
 *       - $ref: '#/components/parameters/FormatFilter'
 *     responses:
 *       '200':
 *         description: Successful response with search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentSearchResultKinozal'
 *       400:
 *         description: Invalid parameters or no results found
 *       404:
 *         description: Provider not found
 *       503:
 *         description: Service unavailable
 */
/**
 * @openapi
 * /api/search/title/rutor:
 *   get:
 *     tags: [Search by Title]
 *     summary: Search RuTor by title
 *     description: Search for torrents on RuTor by title, with optional category filtering and pagination.
 *     parameters:
 *       - $ref: '#/components/parameters/QuerySearch'
 *       - $ref: '#/components/parameters/CategoryFilterRuTor'
 *       - $ref: '#/components/parameters/PageFilterRuTor'
 *     responses:
 *       '200':
 *         description: Successful response with search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentSearchResultRuTor'
 *       400:
 *         description: Invalid parameters or no results found
 *       404:
 *         description: Provider not found
 *       503:
 *         description: Service unavailable
 */
/**
 * @openapi
 * /api/search/title/nonameclub:
 *   get:
 *     tags: [Search by Title]
 *     summary: Search NoNameClub by title
 *     description: Search for torrents on NoNameClub by title, with optional category filtering and pagination.
 *     parameters:
 *       - $ref: '#/components/parameters/QuerySearch'
 *       - $ref: '#/components/parameters/CategoryFilter'
 *       - $ref: '#/components/parameters/PageFilterNoNameClub'
 *     responses:
 *       '200':
 *         description: Successful response with search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentSearchResultNoNameClub'
 *       400:
 *         description: Invalid parameters or no results found
 *       404:
 *         description: Provider not found
 *       503:
 *         description: Service unavailable
 */
/**
 * @openapi
 * /api/search/title/pornolab:
 *   get:
 *     tags: [Search by Title]
 *     summary: Search Pornolab by title
 *     description: Search for torrents on Pornolab by title, with optional category filtering and pagination. Requires valid cookies set in the backend.
 *     parameters:
 *       - $ref: '#/components/parameters/QuerySearch'
 *       - $ref: '#/components/parameters/CategoryFilter' # Assuming Pornolab uses generic category IDs
 *       - $ref: '#/components/parameters/PageFilterPornolab' # Max 10 pages based on code
 *     responses:
 *       '200':
 *         description: Successful response with search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentSearchResultPornolab'
 *       400:
 *         description: Invalid parameters or no results found
 *       404:
 *         description: Provider not found
 *       503:
 *         description: Service unavailable (tracker unreachable, invalid cookies, or error during parsing)
 */
/**
 * @openapi
 * /api/search/title/all:
 *   get:
 *     tags: [Search by Title]
 *     summary: Search all providers by title
 *     description: |-
 *       Search for torrents across all supported providers simultaneously by title.
 *       Allows optional pagination and filtering (note: filters like year/format only apply to specific providers like Kinozal).
 *     parameters:
 *       - $ref: '#/components/parameters/QuerySearch'
 *       - $ref: '#/components/parameters/PageFilterAll' # Generic page filter for 'all'
 *       - $ref: '#/components/parameters/YearFilter' # Applies only to Kinozal within the combined results
 *       - $ref: '#/components/parameters/FormatFilter' # Applies only to Kinozal within the combined results
 *     responses:
 *       '200':
 *         description: Successful response with combined search results from all providers. Each provider's results are in their respective key.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RuTracker:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TorrentSearchResultRuTracker'
 *                 Kinozal:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TorrentSearchResultKinozal'
 *                 RuTor:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TorrentSearchResultRuTor'
 *                 NoNameClub:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TorrentSearchResultNoNameClub'
 *                 Pornolab: # Added
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TorrentSearchResultPornolab'
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Internal error during combined search
 */

// --- Search by ID Endpoints ---
/**
 * @openapi
 * /api/search/id/rutracker:
 *   get:
 *     tags: [Search by ID]
 *     summary: Get RuTracker torrent details by ID
 *     description: Retrieve detailed information about a specific torrent from RuTracker using its ID. Requires valid cookies for file list retrieval.
 *     parameters:
 *       - $ref: '#/components/parameters/IdSearch'
 *     responses:
 *       '200':
 *         description: Successful response with torrent details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentDetailsRuTracker'
 *       400:
 *         description: Invalid or missing ID
 *       404:
 *         description: Provider or Torrent ID not found
 *       503:
 *         description: Service unavailable
 */
/**
 * @openapi
 * /api/search/id/kinozal:
 *   get:
 *     tags: [Search by ID]
 *     summary: Get Kinozal torrent details by ID
 *     description: Retrieve detailed information about a specific torrent from Kinozal using its ID. Requires valid cookies for some details like file list.
 *     parameters:
 *       - $ref: '#/components/parameters/IdSearch'
 *     responses:
 *       '200':
 *         description: Successful response with torrent details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentDetailsKinozal'
 *       400:
 *         description: Invalid or missing ID
 *       404:
 *         description: Provider or Torrent ID not found
 *       503:
 *         description: Service unavailable
 */
/**
 * @openapi
 * /api/search/id/rutor:
 *   get:
 *     tags: [Search by ID]
 *     summary: Get RuTor torrent details by ID
 *     description: Retrieve detailed information about a specific torrent from RuTor using its ID. File list retrieval might depend on site structure/JS.
 *     parameters:
 *       - $ref: '#/components/parameters/IdSearch'
 *     responses:
 *       '200':
 *         description: Successful response with torrent details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentDetailsRuTor'
 *       400:
 *         description: Invalid or missing ID
 *       404:
 *         description: Provider or Torrent ID not found
 *       503:
 *         description: Service unavailable
 */
/**
 * @openapi
 * /api/search/id/nonameclub:
 *   get:
 *     tags: [Search by ID]
 *     summary: Get NoNameClub torrent details by ID
 *     description: Retrieve detailed information about a specific torrent from NoNameClub using its ID. Requires valid cookies for file list retrieval.
 *     parameters:
 *       - $ref: '#/components/parameters/IdSearch'
 *     responses:
 *       '200':
 *         description: Successful response with torrent details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentDetailsNoNameClub'
 *       400:
 *         description: Invalid or missing ID
 *       404:
 *         description: Provider or Torrent ID not found
 *       503:
 *         description: Service unavailable
 */
/**
 * @openapi
 * /api/search/id/pornolab:
 *   get:
 *     tags: [Search by ID]
 *     summary: Get Pornolab torrent details by ID
 *     description: Retrieve detailed information about a specific torrent from Pornolab using its ID. Requires valid cookies for file list retrieval and potentially for accessing the page itself.
 *     parameters:
 *       - $ref: '#/components/parameters/IdSearch'
 *     responses:
 *       '200':
 *         description: Successful response with torrent details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TorrentDetailsPornolab'
 *       400:
 *         description: Invalid or missing ID
 *       404:
 *         description: Provider or Torrent ID not found
 *       503:
 *         description: Service unavailable (tracker unreachable, invalid cookies, or error during parsing)
 */


// --- Reusable Components ---
/**
 * @openapi
 * components:
 *   parameters:
 *     QuerySearch:
 *       name: query
 *       in: query
 *       required: false
 *       description: The search term (movie title, series name, etc.). URL encode if necessary.
 *       schema:
 *         type: string
 *         example: "The Matrix"
 *     IdSearch:
 *       name: query
 *       in: query
 *       required: true
 *       description: The unique ID of the torrent on the specific tracker.
 *       schema:
 *         type: integer
 *         example: 1234567
 *     CategoryFilter:
 *       name: category
 *       in: query
 *       required: false
 *       description: Numeric category ID to filter results. '0' usually means all categories. Get valid IDs from /api/get/category/[provider].
 *       schema:
 *         type: integer
 *         default: 0
 *     CategoryFilterKinozal:
 *       # Specific categories for Kinozal if known, otherwise similar to CategoryFilter
 *       name: category
 *       in: query
 *       required: false
 *       description: Numeric category ID for Kinozal. '0' for all. See /api/get/category/kinozal for valid IDs.
 *       schema:
 *         type: integer
 *         # Add enum with known Kinozal category IDs if desired
 *         default: 0
 *     CategoryFilterRuTor:
 *       # Specific categories for RuTor if known
 *       name: category
 *       in: query
 *       required: false
 *       description: Numeric category ID for RuTor. '0' for all. See /api/get/category/rutor for valid IDs.
 *       schema:
 *         type: integer
 *         # Add enum with known RuTor category IDs if desired
 *         default: 0
 *     PageFilterRuTracker:
 *       name: page
 *       in: query
 *       required: false
 *       description: Page number (0-9) or 'all' to attempt fetching all pages (up to backend limit). Each page contains ~50 results.
 *       schema:
 *         type: string
 *         enum: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "all"]
 *         default: "0"
 *     PageFilterKinozal:
 *       name: page
 *       in: query
 *       required: false
 *       description: Page number (0-99) or 'all'. Each page contains ~50 results.
 *       schema:
 *         type: string
 *         pattern: '^(all|\d{1,2})$' # Allows 'all' or 1-2 digits
 *         default: "0"
 *     PageFilterRuTor:
 *       name: page
 *       in: query
 *       required: false
 *       description: Page number (0-19) or 'all'. Each page contains ~100 results.
 *       schema:
 *         type: string
 *         pattern: '^(all|([0-9]|1[0-9]))$' # Allows 'all' or 0-19
 *         default: "0"
 *     PageFilterNoNameClub:
 *       name: page
 *       in: query
 *       required: false
 *       description: Page number (0-3) or 'all'. Each page contains ~50 results.
 *       schema:
 *         type: string
 *         enum: ["0", "1", "2", "3", "all"]
 *         default: "0"
 *     PageFilterPornolab:
 *       name: page
 *       in: query
 *       required: false
 *       description: Page number (0-9 based on backend limit) or 'all'. Each page contains ~50 results.
 *       schema:
 *         type: string
 *         pattern: '^(all|\d+)$' # Allows 'all' or any number (backend limits to 10)
 *         default: "0"
 *     PageFilterAll:
 *       name: page
 *       in: query
 *       required: false
 *       description: Page number (applied to providers that support it) or 'all'. Note that page limits differ per provider.
 *       schema:
 *         type: string
 *         pattern: '^(all|\d+)$'
 *         default: "0"
 *     YearFilter:
 *       name: year
 *       in: query
 *       required: false
 *       description: Filter by 4-digit release year (primarily for Kinozal). '0' for no filter.
 *       schema:
 *         type: integer
 *         pattern: '^(0|\d{4})$'
 *         default: 0
 *     FormatFilter:
 *       name: format
 *       in: query
 *       required: false
 *       description: Filter by video resolution format (primarily for Kinozal). '0' for all, '720', '1080', '2160'.
 *       schema:
 *         type: integer
 *         enum: [0, 720, 1080, 2160]
 *         default: 0
 *
 *   schemas:
 *     CategoryListResponse:
 *       type: array
 *       description: Response containing a list of categories for a provider.
 *       items:
 *         type: object
 *         description: An object mapping category IDs (string keys) to category names (string values).
 *         additionalProperties:
 *           type: string
 *         example: {"1": "Category One", "15": "Another Category"}
 *     TorrentFile:
 *       type: object
 *       properties:
 *         Name:
 *           type: string
 *           description: Name of the file within the torrent.
 *           example: "movie.part1.mkv"
 *         Size:
 *           type: string
 *           description: Size of the file (e.g., "1.4 GB", "700 MB"). May include units or be just bytes depending on provider/parsing.
 *           example: "1.4 GB"
 *     # --- RSS Schemas ---
 *     RssItemRuTracker:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         link: { type: string, format: url }
 *         updated: { type: string, format: date-time }
 *         title: { type: string }
 *         author: { type: string }
 *         category: { type: string }
 *         categoryLable: { type: string } # Note typo in original code (Lable)
 *     RssItemKinozalCustom:
 *       type: object
 *       properties:
 *         date: { type: string, format: date-time }
 *         title: { type: string }
 *         category: { type: string }
 *         link: { type: string, format: url }
 *         downloadLink: { type: string, format: url }
 *         size: { type: string }
 *         comments: { type: string }
 *         seeds: { type: string }
 *         peers: { type: string }
 *     RssItemRuTorCustom:
 *       type: object
 *       properties:
 *         date: { type: string, format: date-time }
 *         title: { type: string }
 *         link: { type: string, format: url }
 *         downloadLink: { type: string, format: url }
 *         magnet: { type: string, format: uri }
 *         size: { type: string }
 *         comments: { type: integer }
 *         seeds: { type: integer }
 *         peers: { type: integer }
 *     RssItemNoNameClub:
 *       type: object
 *       properties:
 *         # Define properties based on NoNameClubRSS JSON structure
 *         title: { type: string }
 *         link: { type: string, format: url }
 *         pubDate: { type: string }
 *         description: { type: string }
 *         # Add other relevant fields like enclosure, comments etc. if parsed
 *         enclosure: { type: object, properties: { url: { type: string }, type: { type: string } } }
 *     # --- Search Result Schemas ---
 *     TorrentSearchResultRuTracker:
 *       type: object
 *       properties:
 *         Name: { type: string, description: Torrent title }
 *         Id: { type: string, description: Torrent ID }
 *         Url: { type: string, format: url, description: URL to the torrent page }
 *         Torrent: { type: string, format: url, description: URL to download the .torrent file }
 *         Size: { type: string, description: "Torrent size (e.g., '1.4 GB')" } # Corrected: Use simple string for description
 *         Download_Count: { type: string, description: Approximate download count }
 *         Checked: { type: string, enum: ["True", "False"], description: Whether the torrent is verified } # String "True"/"False" based on code
 *         Category: { type: string, description: Category name }
 *         Seeds: { type: string, description: Number of seeders }
 *         Peers: { type: string, description: Number of leechers }
 *         Date: { type: string, description: Date added (dd.mm.yyyy) }
 *     TorrentSearchResultKinozal:
 *       type: object
 *       properties:
 *         Name: { type: string, description: Full torrent title }
 *         Title: { type: string, description: Parsed title part }
 *         Id: { type: string }
 *         Original_Name: { type: string, nullable: true }
 *         Year: { type: string, nullable: true }
 *         Language: { type: string, nullable: true }
 *         Format: { type: string, nullable: true }
 *         Url: { type: string, format: url }
 *         Torrent: { type: string, format: url }
 *         Size: { type: string }
 *         Comments: { type: string }
 *         Category: { type: string }
 *         Seeds: { type: string }
 *         Peers: { type: string }
 *         Time: { type: string, description: Time added (hh:mm) }
 *         Date: { type: string, description: Date added (dd.mm.yyyy) }
 *     TorrentSearchResultRuTor:
 *       type: object
 *       properties:
 *          Name: { type: string }
 *          Id: { type: string }
 *          Url: { type: string, format: url }
 *          Torrent: { type: string, format: url }
 *          Hash: { type: string }
 *          Size: { type: string }
 *          Comments: { type: string }
 *          Seeds: { type: string }
 *          Peers: { type: string }
 *          Date: { type: string }
 *     TorrentSearchResultNoNameClub:
 *       type: object
 *       properties:
 *          Name: { type: string }
 *          Id: { type: string }
 *          Url: { type: string, format: url }
 *          Torrent: { type: string, format: url }
 *          Size: { type: string }
 *          Comments: { type: string }
 *          Category: { type: string }
 *          Seeds: { type: string }
 *          Peers: { type: string }
 *          Time: { type: string }
 *          Date: { type: string }
 *     TorrentSearchResultPornolab:
 *       type: object
 *       properties:
 *         Name: { type: string }
 *         Id: { type: string }
 *         Url: { type: string, format: url }
 *         Torrent: { type: string, format: url }
 *         Size: { type: string }
 *         Download_Count: { type: string }
 *         Checked: { type: string, enum: ["True", "False"] }
 *         Category: { type: string }
 *         Seeds: { type: string }
 *         Peers: { type: string }
 *         Date: { type: string }
 *     # --- Torrent Details Schemas ---
 *     TorrentDetailsRuTracker:
 *       type: object
 *       properties:
 *         Name: { type: string }
 *         Url: { type: string, format: url }
 *         Hash: { type: string }
 *         Magnet: { type: string, format: uri }
 *         Torrent: { type: string, format: url }
 *         IMDb_link: { type: string, format: url, nullable: true }
 *         Kinopoisk_link: { type: string, format: url, nullable: true }
 *         IMDb_id: { type: string, nullable: true }
 *         Kinopoisk_id: { type: string, nullable: true }
 *         Year: { type: string, nullable: true }
 *         Release: { type: string, nullable: true, description: "Country" }
 *         Type: { type: string, nullable: true, description: "Genre" }
 *         Duration: { type: string, nullable: true }
 *         Audio: { type: string, nullable: true, description: "Audio language/translation" }
 *         Voice: { type: string, nullable: true, description: "Voice-over type" }
 *         Lang: { type: string, nullable: true, description: "Interface Language (for games)" }
 *         Multiplayer: { type: string, nullable: true }
 *         Age: { type: string, nullable: true }
 *         Directer: { type: string, nullable: true }
 *         Actors: { type: string, nullable: true }
 *         Description: { type: string, nullable: true }
 *         Quality: { type: string, nullable: true }
 *         Video: { type: string, nullable: true }
 *         AudioSpec: { type: string, nullable: true, description: "Audio technical specs" }
 *         Poster: { type: string, format: url, nullable: true }
 *         Files:
 *           type: array
 *           items: { $ref: '#/components/schemas/TorrentFile' }
 *     TorrentDetailsKinozal:
 *       # Define properties based on KinozalID response structure
 *       type: object
 *       properties:
 *          Name: { type: string }
 *          Original_Name: { type: string, nullable: true }
 *          Url: { type: string, format: url }
 *          Hash: { type: string }
 *          Magnet: { type: string, format: uri }
 *          Torrent: { type: string, format: url }
 *          IMDb_link: { type: string, format: url, nullable: true }
 *          Kinopoisk_link: { type: string, format: url, nullable: true }
 *          IMDb_id: { type: string, nullable: true }
 *          Kinopoisk_id: { type: string, nullable: true }
 *          Year: { type: string, nullable: true }
 *          Type: { type: string, nullable: true, description: "Genre" }
 *          Release: { type: string, nullable: true, description: "Country/Production" }
 *          Directer: { type: string, nullable: true }
 *          Actors: { type: string, nullable: true }
 *          Description: { type: string, nullable: true }
 *          Quality: { type: string, nullable: true }
 *          Video: { type: string, nullable: true }
 *          Audio: { type: string, nullable: true }
 *          Size: { type: string }
 *          Duration: { type: string, nullable: true }
 *          Transcript: { type: string, nullable: true }
 *          Seeds: { type: string }
 *          Peers: { type: string }
 *          Download_Count: { type: string }
 *          Files_Count: { type: string }
 *          Comments: { type: string }
 *          IMDb_Rating: { type: string, nullable: true }
 *          Kinopoisk_Rating: { type: string, nullable: true }
 *          Kinozal_Rating: { type: string, nullable: true }
 *          Votes: { type: string, nullable: true }
 *          Added_Date: { type: string, nullable: true }
 *          Update_Date: { type: string, nullable: true }
 *          Poster: { type: string, format: url, nullable: true }
 *          Posters: { type: array, items: { type: string, format: url }, nullable: true }
 *          Files:
 *            type: array
 *            items: { $ref: '#/components/schemas/TorrentFile' }
 *     TorrentDetailsRuTor:
 *       # Define properties based on RuTorID response structure
 *       type: object
 *       properties:
 *          Name: { type: string }
 *          Url: { type: string, format: url }
 *          Hash: { type: string }
 *          Magnet: { type: string, format: uri }
 *          Torrent: { type: string, format: url }
 *          IMDb_link: { type: string, format: url, nullable: true }
 *          Kinopoisk_link: { type: string, format: url, nullable: true }
 *          IMDb_id: { type: string, nullable: true }
 *          Kinopoisk_id: { type: string, nullable: true }
 *          Rating: { type: string, nullable: true }
 *          Category: { type: string, nullable: true }
 *          Seeds: { type: string, nullable: true }
 *          Peers: { type: string, nullable: true }
 *          Seed_Date: { type: string, nullable: true }
 *          Add_Date: { type: string, nullable: true }
 *          Size: { type: string, nullable: true }
 *          Poster: { type: string, format: url, nullable: true }
 *          Files:
 *            type: array
 *            items: { $ref: '#/components/schemas/TorrentFile' }
 *     TorrentDetailsNoNameClub:
 *       # Define properties based on NoNameClubID response structure
 *       type: object
 *       properties:
 *          Name: { type: string }
 *          Url: { type: string, format: url }
 *          Hash: { type: string }
 *          Magnet: { type: string, format: uri }
 *          Torrent: { type: string, format: url }
 *          IMDb_link: { type: string, format: url, nullable: true }
 *          Kinopoisk_link: { type: string, format: url, nullable: true }
 *          IMDb_id: { type: string, nullable: true }
 *          Kinopoisk_id: { type: string, nullable: true }
 *          Release: { type: string, nullable: true }
 *          Type: { type: string, nullable: true }
 *          Directer: { type: string, nullable: true }
 *          Actors: { type: string, nullable: true }
 *          Description: { type: string, nullable: true }
 *          Duration: { type: string, nullable: true }
 *          Quality: { type: string, nullable: true }
 *          Video: { type: string, nullable: true }
 *          Audio: { type: string, nullable: true }
 *          Registration: { type: string, nullable: true }
 *          Rating: { type: string, nullable: true }
 *          Votes: { type: string, nullable: true }
 *          Size: { type: string, nullable: true }
 *          Poster: { type: string, format: url, nullable: true }
 *          Files:
 *            type: array
 *            items: { $ref: '#/components/schemas/TorrentFile' }
 *     TorrentDetailsPornolab:
 *       type: object
 *       properties:
 *         Name: { type: string }
 *         Url: { type: string, format: url }
 *         Hash: { type: string, nullable: true }
 *         Magnet: { type: string, format: uri, nullable: true }
 *         Torrent: { type: string, format: url }
 *         IMDb_link: { type: string, format: url, nullable: true }
 *         Kinopoisk_link: { type: string, format: url, nullable: true }
 *         IMDb_id: { type: string, nullable: true }
 *         Kinopoisk_id: { type: string, nullable: true }
 *         Year: { type: string, nullable: true }
 *         Release: { type: string, nullable: true, description: "Country/Production" }
 *         Type: { type: string, nullable: true, description: "Genre" }
 *         Duration: { type: string, nullable: true }
 *         Description: { type: string, nullable: true }
 *         Quality: { type: string, nullable: true }
 *         Video: { type: string, nullable: true }
 *         Audio: { type: string, nullable: true, description: "Audio/Translation details" }
 *         Directer: { type: string, nullable: true }
 *         Actors: { type: string, nullable: true }
 *         Poster: { type: string, format: url, nullable: true }
 *         Files:
 *           type: array
 *           items: { $ref: '#/components/schemas/TorrentFile' }
 */