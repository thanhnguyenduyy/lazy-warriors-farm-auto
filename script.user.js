// ==UserScript==
// @name         Lazy Warriors Farm Auto
// @namespace    local.at-sp.notification-monitor
// @version      2.78.53
// @description  Automates farm tasks, neighbor help, games, restaurant, ranch, and mythical beast actions.
// @match        https://at-sp.ssvhue.work/*
// @updateURL    https://raw.githubusercontent.com/thanhnguyenduyy/lazy-warriors-farm-auto/refs/heads/main/script.meta.js
// @downloadURL  https://raw.githubusercontent.com/thanhnguyenduyy/lazy-warriors-farm-auto/refs/heads/main/script.user.js
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      generativelanguage.googleapis.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
  "use strict";

  if (window.top !== window.self) return;

  const GM_getValue =
    typeof globalThis.GM_getValue === "function"
      ? globalThis.GM_getValue.bind(globalThis)
      : (key, fallback) => {
          try {
            const raw = localStorage.getItem(String(key));
            return raw === null ? fallback : JSON.parse(raw);
          } catch (_error) {
            return fallback;
          }
        };

  const GM_setValue =
    typeof globalThis.GM_setValue === "function"
      ? globalThis.GM_setValue.bind(globalThis)
      : (key, value) => {
          try {
            localStorage.setItem(String(key), JSON.stringify(value));
          } catch (_error) {}
        };

  function createGmRequestFallback() {
    if (typeof globalThis.fetch !== "function") return null;
    return (details = {}) => {
      const controller =
        typeof globalThis.AbortController === "function"
          ? new globalThis.AbortController()
          : null;
      let timedOut = false;
      let timeoutId = null;
      const timeoutMs = Number(details.timeout);

      if (controller && Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timeoutId = globalThis.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);
      }

      const run = async () => {
        const init = {
          method: details.method || "GET",
          headers: details.headers || undefined,
        };
        if (controller) init.signal = controller.signal;
        if (details.data !== undefined && init.method !== "GET" && init.method !== "HEAD") {
          init.body = details.data;
        }

        const response = await globalThis.fetch(details.url, init);
        const status = response.status;
        let responseText = "";
        let responseData;

        if (details.responseType === "arraybuffer") {
          responseData = await response.arrayBuffer();
          responseText = "";
        } else {
          responseText = await response.text();
          responseData = responseText;
        }

        if (typeof details.onload === "function") {
          details.onload({
            status,
            statusText: response.statusText || "",
            responseText,
            response: responseData,
            readyState: 4,
            finalUrl: response.url || details.url,
          });
        }
      };

      Promise.resolve()
        .then(run)
        .catch((error) => {
          if (timedOut) {
            if (typeof details.ontimeout === "function") details.ontimeout(error);
            return;
          }
          if (typeof details.onerror === "function") details.onerror(error);
        })
        .finally(() => {
          if (timeoutId != null) globalThis.clearTimeout(timeoutId);
        });
    };
  }

  const GM_xmlhttpRequest = (() => {
    const gmObject = typeof GM !== "undefined" ? GM : globalThis.GM;
    const native =
      typeof globalThis.GM_xmlhttpRequest === "function"
        ? globalThis.GM_xmlhttpRequest.bind(globalThis)
        : typeof globalThis.GM_xmlHttpRequest === "function"
          ? globalThis.GM_xmlHttpRequest.bind(globalThis)
          : gmObject && typeof gmObject.xmlHttpRequest === "function"
            ? (details) => gmObject.xmlHttpRequest(details)
            : gmObject && typeof gmObject.GM_xmlhttpRequest === "function"
              ? (details) => gmObject.GM_xmlhttpRequest(details)
              : null;
    return native || createGmRequestFallback();
  })();

  const DEFAULT_CHECK_INTERVAL_MS = 1_000;
  const NEIGHBOR_RETRY_COOLDOWN_MS = 30_000;
  const DAYTIME_RESTRICTION_START_MINUTE = 8 * 60 + 30;
  const DAYTIME_RESTRICTION_END_MINUTE = 17 * 60 + 30;
  const VIETNAM_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const RESTAURANT_CHECK_INTERVAL_MS = 60_000;
  const RANCH_CHECK_INTERVAL_MS = 60_000;
  const RANCH_INITIAL_DELAY_MS = 30_000;
  const HONEY_TASK_PATTERN = /\d+\s*tổ ong có mật/i;
  const RIPE_FIELD_TASK_PATTERN = /\d+\s*ô ruộng chín/i;
  const FIELD_CARE_TASK_PATTERN = /\d+\s*ô ruộng cần chăm/i;
  const ANIMAL_TASK_PATTERN = /\d+\s*con thú chờ thu/i;
  const ANIMAL_CARE_TASK_PATTERN = /\d+\s*con thú đói\s*\/\s*khát/i;
  const MYTHICAL_HUNGRY_TASK_PATTERN = /\d+\s*ổ đói/i;
  const SICK_ANIMAL_TASK_PATTERN = /\d+\s*con thú bị ốm/i;
  const POND_TASK_PATTERN = /\d+\s*ô ao vớt được/i;
  const MACHINE_TASK_PATTERN = /\d+\s*máy đã làm xong/i;
  const FRUIT_TASK_PATTERN = /\d+\s*cây có quả/i;
  const FLOWER_TASK_PATTERN = /\d+\s*luống hoa nở/i;
  const WEED_TASK_PATTERN = /\d+\s*luống cỏ mọc/i;
  const DRYING_RACK_TASK_PATTERN = /\d+\s*giá khô/i;
  const SILKWORM_DONE_TASK_PATTERN = /\d+\s*n[oô]ng\s+nuôi\s+tằm\s+xong/i;
  const MUSHROOM_HOUSE_DONE_TASK_PATTERN = /\d+\s*giá nhà nấm xong/i;
  const HERB_GARDEN_DONE_TASK_PATTERN = /\d+\s*luống vườn thuốc xong/i;
  const FOREST_DONE_TASK_PATTERN =
    /\d+\s*(?:khoảnh.*rừng|khoảnh\s*(?:xong|chờ|thu|đốn|chặt|lớn)|(?:cây\s*)?rừng\s*(?:xong|chờ|thu|đốn|chặt|lớn))/i;
  const DELIVERY_TASK_PATTERN = /\d+\s*đơn hàng giao được/i;
  const RESTAURANT_READY_TASK_PATTERN =
    /\d+\s+khách\s+ở\s+quán\s+ăn.*\d+\s+phục\s+vụ\s+được\s+ngay/i;
  const COMPOST_TASK_PATTERN = /\d+\s*hố.*ủ phân xong/i;
  const DRY_COMPOST_PIT_TASK_PATTERN = /\d+\s*hố khô/i;
  const RETURNED_EXPLORATION_TASK_PATTERN = /\d+\s*chuyến khám phá đã về/i;
  const FIELD_CROP_OPTIONS = [
    "Cà rốt",
    "Ngô",
    "Cà chua",
    "Lúa mì",
    "Dâu tây",
    "Bí ngô",
    "Nho",
    "Thóc",
    "Lá dâu",
  ];
  const FLOWER_CROP_OPTIONS = [
    "Hoa cúc",
    "Hoa hồng",
    "Cẩm chướng",
    "Oải hương",
    "Cẩm tú cầu",
    "Hoa lan",
  ];
  const MUSHROOM_CROP_OPTIONS = ["Nấm hương", "Nấm linh chi"];
  const MEDICINE_CROP_OPTIONS = ["Bạc hà", "Ngải cứu", "Nhân sâm"];
  const FOREST_CROP_OPTIONS = ["Tre", "Gỗ lim"];
  const POND_FISH_OPTIONS = ["Cá", "Tôm", "Cá rô", "Cua", "Trai ngọc", "Cá koi"];
  const NO_SELECTION_OPTION = "Không chọn";
  const RANDOM_SELECTION_OPTION = "Random";
  const WORKSHOP_MACHINE_OPTIONS = [
    {
      key: "bakery",
      label: "Lò bánh",
      products: ["Bánh mì", "Bánh mật ong"],
    },
    {
      key: "press",
      label: "Máy ép",
      products: ["Nước táo", "Nước cam"],
    },
    { key: "dairy", label: "Xưởng sữa", products: ["Phô mai"] },
    {
      key: "chocolatier",
      label: "Xưởng sô-cô-la",
      products: ["Sô-cô-la", "Bánh trứng đà điểu"],
    },
    {
      key: "teaHouse",
      label: "Lò sao chè",
      products: ["Trà xanh", "Trà linh chi", "Trà sâm"],
    },
    {
      key: "jeweler",
      label: "Xưởng trang sức",
      products: ["Nhẫn ngọc trai", "Vòng pha lê", "Khăn alpaca đính ngọc"],
    },
    {
      key: "forge",
      label: "Xưởng Rèn",
      products: ["Kiếm thép", "Cung trúc", "Giáo sắt", "Rìu chiến", "Búa đá"],
    },
    {
      key: "jamKitchen",
      label: "Bếp mứt",
      products: ["Nước nho", "Mứt dâu", "Súp nấm"],
    },
    {
      key: "dryingRack",
      label: "Giàn phơi",
      products: ["Cá khô", "Tôm khô"],
    },
    {
      key: "sauceWorkshop",
      label: "Xưởng sốt",
      products: ["Mứt bí", "Sốt cà chua"],
    },
    {
      key: "grandKitchen",
      label: "Bếp lớn",
      products: ["Cà ri cua", "Bánh mì kẹp", "Súp nấm cục", "Phô mai dê"],
    },
    {
      key: "roaster",
      label: "Lò rang",
      products: ["Cà phê rang", "Cà phê sữa"],
    },
    {
      key: "dragonAltar",
      label: "Đền rồng",
      products: ["Khiên vảy rồng"],
    },
    {
      key: "silkMill",
      label: "Xưởng ươm tơ",
      products: ["Tơ tằm", "Lụa"],
    },
    {
      key: "loom",
      label: "Khung dệt",
      products: ["Khăn len", "Áo len"],
    },
    {
      key: "medicineKiln",
      label: "Lò thuốc",
      products: [
        "Thuốc trừ sâu ×5",
        "Thuốc trị bệnh cây ×5",
        "Thuốc thú y ×4",
        "Trà thảo dược",
      ],
    },
    {
      key: "alchemy",
      label: "Đan phòng",
      products: ["Tiên đan", "Hoàn Long Đan"],
    },
    {
      key: "pastryShop",
      label: "Tiệm bánh ngọt",
      products: ["Bánh bí", "Trà vải", "Bánh dừa", "Bánh chuối", "Sinh tố xoài"],
    },
    {
      key: "mill",
      label: "Nhà xay",
      products: ["Gạo", "Bánh gạo"],
    },
    {
      key: "tailor",
      label: "Tiệm may",
      products: ["Mũ lông thỏ", "Hộp quà Tết"],
    },
    {
      key: "vegetarianKitchen",
      label: "Bếp chay",
      products: ["Cơm nấm hương", "Lẩu nấm"],
    },
    {
      key: "carpenter",
      label: "Xưởng mộc",
      products: ["Giỏ tre", "Quạt lông công", "Rương gỗ lim"],
    },
  ];
  const MYTHICAL_BEAST_OPTIONS = ["Rồng", "Kỳ lân"];
  const EXPLORATION_PLACE_OPTIONS = [
    "Rừng thông",
    "Hồ sen",
    "Mỏ đá",
    "Núi tuyết",
    "Rừng nhiệt đới",
    "Hang pha lê",
  ];
  const FIELD_CROP_STORAGE_KEY = "at-sp.field-crop";
  const FLOWER_CROP_STORAGE_KEY = "at-sp.flower-crop";
  const MUSHROOM_CROP_STORAGE_KEY = "at-sp.mushroom-crop";
  const MEDICINE_CROP_STORAGE_KEY = "at-sp.medicine-crop";
  const FOREST_CROP_STORAGE_KEY = "at-sp.forest-crop";
  const POND_FISH_STORAGE_KEY = "at-sp.pond-fish";
  const WORKSHOP_RECIPE_STORAGE_PREFIX = "at-sp.workshop-recipe.";
  const WORKSHOP_MACHINE_TOGGLE_PREFIX = "workshopMachine:";
  const WORKSHOP_HIDDEN_STYLE_PROPERTIES = [
    "position",
    "left",
    "top",
    "pointer-events",
  ];
  const hiddenWorkshopCardStyles = new WeakMap();
  const MYTHICAL_BEAST_STORAGE_KEY = "at-sp.mythical-beast";
  const EXPLORATION_PLACE_STORAGE_KEY = "at-sp.exploration-place";
  const EXPLORATION_PLACE_SECOND_STORAGE_KEY = "at-sp.exploration-place-second";
  const EXPLORATION_PLACE_THIRD_STORAGE_KEY = "at-sp.exploration-place-third";
  const CONTROL_POSITION_STORAGE_KEY = "at-sp.control-position-v3";
  const FEATURE_TOGGLE_STORAGE_PREFIX = "at-sp.feature.";
  const AUTOMATION_SCHEDULE_TOGGLE_KEY = "automationSchedule";
  const GAME_GEMINI_KEY_STORAGE_KEY = "at-sp.games.gemini-key";
  const GAME_GEMINI_MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
  ];
  const AUTOMATION_FEATURE_GROUPS = [
    {
      name: "Ruộng",
      icon: "🌱",
      features: [
        { key: "field", label: "Ruộng" },
        { key: "flowers", label: "Hoa" },
        { key: "bees", label: "Ong" },
        { key: "trees", label: "Cây" },
        { key: "mushrooms", label: "Nấm" },
        { key: "medicine", label: "Thuốc" },
        { key: "homeWeed", label: "Nhổ cỏ vườn nhà" },
        { key: "homePest", label: "Bắt sâu vườn nhà" },
        { key: "forest", label: "Rừng" },
      ],
    },
    {
      name: "Chuồng",
      icon: "🐮",
      features: [
        { key: "ranch", label: "Chuồng" },
        { key: "pond", label: "Ao" },
        { key: "workshop", label: "Xưởng" },
        { key: "silkworm", label: "Tằm" },
        { key: "compost", label: "Ủ phân" },
        { key: "mythical", label: "Thần thú" },
      ],
    },
    {
      name: "Làng",
      icon: "🏘️",
      features: [
        { key: "exploration", label: "Khám phá" },
        { key: "games", label: "Trò chơi" },
        { key: "villagers", label: "Dân Làng" },
      ],
    },
    {
      name: "Hàng xóm",
      icon: "👫",
      features: [
        { key: "neighborWater", label: "Tưới nước giúp" },
        { key: "neighborHumidity", label: "Phun ẩm giúp" },
        { key: "neighborPest", label: "Bắt sâu giúp" },
        { key: "neighborWeed", label: "Nhổ cỏ giúp" },
        { key: "neighborPrune", label: "Tỉa cành giúp" },
        { key: "neighborCompost", label: "Ủ phân giúp" },
        { key: "neighborSilkworm", label: "Cho tằm ăn" },
        { key: "neighborFeed", label: "Cho thú ăn" },
      ],
    },
  ];
  const CROP_ICONS = {
    "Cà rốt": ["carrot", "🥕"],
    Ngô: ["corn", "🌽"],
    "Cà chua": ["tomato", "🍅"],
    "Lúa mì": ["wheat", "🌾"],
    "Dâu tây": ["strawberry", "🍓"],
    "Bí ngô": ["pumpkin", "🎃"],
    Nho: ["grape", "🍇"],
    Thóc: ["rice", "🌾"],
    "Lá dâu": ["mulberry", "🍃"],
    "Hoa cúc": ["chrysanthemum", "🌼"],
    "Hoa hồng": ["rose", "🌹"],
    "Cẩm chướng": ["carnation", "🌺"],
    "Oải hương": ["lavender", "💜"],
    "Cẩm tú cầu": ["hydrangea", "💐"],
    "Hoa lan": ["orchid", "🌸"],
    "Nấm hương": ["shiitake", "🍄"],
    "Nấm linh chi": ["lingzhi", "🍄"],
    "Bạc hà": ["mint", "🌿"],
    "Ngải cứu": ["mugwort", "🌿"],
    "Nhân sâm": ["ginseng", "🌿"],
    Tre: ["bamboo", "🎋"],
    "Gỗ lim": ["wood", "🪵"],
    Cá: ["fish", "🐟"],
    Tôm: ["shrimp", "🦐"],
    "Cá rô": ["anabas", "🐟"],
    Cua: ["crab", "🦀"],
    "Trai ngọc": ["clam", "🦪"],
    "Cá koi": ["koi", "🐠"],
  };
  const ANIMAL_ACTION_PATTERNS = [
    /Cho ăn hết/i,
    /Cho uống hết/i,
    /^Thu hết/i,
  ];
  const MYTHICAL_ACTION_PATTERNS = [
    /^Ấp hết(?:\s*\(\d+\))?$/i,
    /^Cho ăn hết(?:\s*\(\d+\))?$/i,
    /^Thu hết(?:\s*\(\d+\))?$/i,
  ];
  const ACTION_CLICK_DELAY_MS = 500;
  const MAX_ANIMAL_ACTION_CLICKS = 100;
  const MACHINE_RESTART_DELAY_MS = 3_000;
  const MACHINE_RECIPE_READY_TIMEOUT_MS = 10_000;
  let isRunning = false;
  let runGeneration = 0;
  let activeCheckGeneration = null;
  let activeFeatureKey = null;
  let intervalId = null;
  let restaurantIntervalId = null;
  let ranchIntervalId = null;
  let ranchStartTimeoutId = null;
  let isRestaurantCheckActive = false;
  let isRanchCheckActive = false;
  let isNeighborCheckActive = false;
  let isGameCheckActive = false;
  let isPriorityCycleActive = false;
  let lastNoTaskLogAt = 0;
  let lastNoGameOptionsLogAt = 0;
  let lastMissingGameKeyLogAt = 0;
  let nextGameCheckAfter = 0;
  const neighborRetryAfter = new Map();
  let checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
  let selectedFieldCrop = readStoredOption(
    FIELD_CROP_STORAGE_KEY,
    FIELD_CROP_OPTIONS,
    "Cà rốt",
  );
  let selectedFlowerCrop = readStoredOption(
    FLOWER_CROP_STORAGE_KEY,
    FLOWER_CROP_OPTIONS,
    "Hoa cúc",
  );
  let selectedMushroomCrop = readStoredOption(
    MUSHROOM_CROP_STORAGE_KEY,
    MUSHROOM_CROP_OPTIONS,
    "Nấm hương",
  );
  let selectedMedicineCrop = readStoredOption(
    MEDICINE_CROP_STORAGE_KEY,
    MEDICINE_CROP_OPTIONS,
    "Bạc hà",
  );
  let selectedForestCrop = readStoredOption(
    FOREST_CROP_STORAGE_KEY,
    FOREST_CROP_OPTIONS,
    "Tre",
  );
  let selectedPondFish = readStoredOption(
    POND_FISH_STORAGE_KEY,
    [...POND_FISH_OPTIONS, NO_SELECTION_OPTION],
    "Cá",
  );
  const savedWorkshopRecipes = Object.fromEntries(
    WORKSHOP_MACHINE_OPTIONS.map((machine) => [
      machine.key,
      readStoredOption(
        `${WORKSHOP_RECIPE_STORAGE_PREFIX}${machine.key}`,
        [
          ...machine.products,
          RANDOM_SELECTION_OPTION,
          NO_SELECTION_OPTION,
        ],
        machine.key === "forge"
          ? NO_SELECTION_OPTION
          : machine.key === "medicineKiln"
            ? "Trà thảo dược"
            : RANDOM_SELECTION_OPTION,
      ),
    ]),
  );
  let selectedForgeRecipe =
    savedWorkshopRecipes.forge === NO_SELECTION_OPTION
      ? RANDOM_SELECTION_OPTION
      : savedWorkshopRecipes.forge;
  let selectedMythicalBeast = readStoredOption(
    MYTHICAL_BEAST_STORAGE_KEY,
    [...MYTHICAL_BEAST_OPTIONS, NO_SELECTION_OPTION],
    "Kỳ lân",
  );
  let selectedExplorationPlace = readStoredOption(
    EXPLORATION_PLACE_STORAGE_KEY,
    EXPLORATION_PLACE_OPTIONS,
    "Rừng thông",
  );
  let selectedExplorationPlaceSecond = readStoredOption(
    EXPLORATION_PLACE_SECOND_STORAGE_KEY,
    EXPLORATION_PLACE_OPTIONS,
    "Mỏ đá",
  );
  let selectedExplorationPlaceThird = readStoredOption(
    EXPLORATION_PLACE_THIRD_STORAGE_KEY,
    EXPLORATION_PLACE_OPTIONS,
    "Núi tuyết",
  );

  function readStoredOption(key, options, defaultValue) {
    try {
      const value = window.localStorage.getItem(key);
      return options.includes(value) ? value : defaultValue;
    } catch (error) {
      console.warn(`[AT-SP] Không đọc được tùy chọn đã lưu (${key}).`, error);
      return defaultValue;
    }
  }

  function storeOption(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[AT-SP] Không lưu được tùy chọn (${key}).`, error);
    }
  }

  function readStoredToggle(
    key,
    defaultValue = !["mushrooms", "neighborSilkworm", "games", "villagers"].includes(
      key,
    ),
  ) {
    try {
      const value = window.localStorage.getItem(
        `${FEATURE_TOGGLE_STORAGE_PREFIX}${key}`,
      );
      return value === null ? defaultValue : value === "true";
    } catch (error) {
      console.warn(`[AT-SP] Không đọc được trạng thái tự động (${key}).`, error);
      return defaultValue;
    }
  }

  const enabledFeatures = Object.fromEntries([
    ...AUTOMATION_FEATURE_GROUPS.flatMap((group) =>
      group.features.map((feature) => [
        feature.key,
        readStoredToggle(feature.key),
      ]),
    ),
    [
      AUTOMATION_SCHEDULE_TOGGLE_KEY,
      readStoredToggle(AUTOMATION_SCHEDULE_TOGGLE_KEY, true),
    ],
    ...WORKSHOP_MACHINE_OPTIONS.map((machine) => {
      const toggleKey = `${WORKSHOP_MACHINE_TOGGLE_PREFIX}${machine.key}`;
      const defaultEnabled =
        !["jeweler", "forge", "carpenter", "dragonAltar"].includes(
          machine.key,
        ) &&
        savedWorkshopRecipes[machine.key] !== NO_SELECTION_OPTION;
      return [
        toggleKey,
        readStoredToggle(toggleKey, defaultEnabled),
      ];
    }),
  ]);

  function isFeatureEnabled(key) {
    return enabledFeatures[key] !== false;
  }

  function getTaskFeature(message) {
    if (HONEY_TASK_PATTERN.test(message)) return "bees";
    if (RIPE_FIELD_TASK_PATTERN.test(message)) return "field";
    if (FIELD_CARE_TASK_PATTERN.test(message)) return "homePest";
    if (
      ANIMAL_TASK_PATTERN.test(message) ||
      ANIMAL_CARE_TASK_PATTERN.test(message) ||
      SICK_ANIMAL_TASK_PATTERN.test(message)
    ) {
      return "ranch";
    }
    if (MYTHICAL_HUNGRY_TASK_PATTERN.test(message)) return "mythical";
    if (POND_TASK_PATTERN.test(message)) return "pond";
    if (MACHINE_TASK_PATTERN.test(message)) return "workshop";
    if (FRUIT_TASK_PATTERN.test(message)) return "trees";
    if (FLOWER_TASK_PATTERN.test(message)) return "flowers";
    if (WEED_TASK_PATTERN.test(message)) return "homeWeed";
    if (HERB_GARDEN_DONE_TASK_PATTERN.test(message)) {
      return "medicine";
    }
    if (FOREST_DONE_TASK_PATTERN.test(message)) return "forest";
    if (
      DRYING_RACK_TASK_PATTERN.test(message) ||
      SILKWORM_DONE_TASK_PATTERN.test(message)
    ) {
      return "silkworm";
    }
    if (MUSHROOM_HOUSE_DONE_TASK_PATTERN.test(message)) return "mushrooms";
    if (RESTAURANT_READY_TASK_PATTERN.test(message)) return "villagers";
    if (DELIVERY_TASK_PATTERN.test(message)) return "villagers";
    if (
      COMPOST_TASK_PATTERN.test(message) ||
      DRY_COMPOST_PIT_TASK_PATTERN.test(message)
    ) {
      return "compost";
    }
    if (RETURNED_EXPLORATION_TASK_PATTERN.test(message)) return "exploration";
    return null;
  }

  function matchesSeedName(button, selectedName) {
    const buttonName = button.querySelector("b")?.textContent.trim() ?? "";
    const normalize = (name) =>
      name.trim().replace(/^hoa\s+/i, "").toLocaleLowerCase();
    return normalize(buttonName) === normalize(selectedName);
  }

  async function selectSeed(selectedName, taskLabel, generation) {
    const seedButton = await waitFor(
      () =>
        findVisibleMatching(
          ".fm-seeds button.fm-seed",
          (button) => matchesSeedName(button, selectedName) && !button.disabled,
        ),
      3_000,
      generation,
    );

    if (!shouldContinue(generation)) return false;
    if (!seedButton) {
      console.warn(`[AT-SP] Không tìm thấy ${taskLabel} "${selectedName}".`);
      return false;
    }

    if (
      seedButton.getAttribute("aria-checked") === "true" ||
      seedButton.classList.contains("on")
    ) {
      return true;
    }

    seedButton.click();
    const selectedButton = await waitFor(
      () =>
        findVisibleMatching(
          ".fm-seeds button.fm-seed",
          (button) =>
            matchesSeedName(button, selectedName) &&
            (button.getAttribute("aria-checked") === "true" ||
              button.classList.contains("on")),
        ),
      3_000,
      generation,
    );

    if (!shouldContinue(generation)) return false;
    if (!selectedButton) {
      console.warn(`[AT-SP] Không thể chọn ${taskLabel} "${selectedName}".`);
      return false;
    }

    console.info(`[AT-SP] Đã chọn ${taskLabel}: ${selectedName}.`);
    return true;
  }

  function isVisible(element) {
    const view = element.ownerDocument.defaultView;
    if (!view) return false;
    const style = view.getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      bounds.width > 0 &&
      bounds.height > 0
    );
  }

  function getPageDocuments() {
    const documents = [document];
    const visited = new Set(documents);

    for (let index = 0; index < documents.length; index += 1) {
      for (const frame of documents[index].querySelectorAll("iframe, frame")) {
        const frameDocument = frame.contentDocument;
        if (frameDocument && !visited.has(frameDocument)) {
          visited.add(frameDocument);
          documents.push(frameDocument);
        }
      }
    }

    return documents;
  }

  function findVisible(selector) {
    for (const pageDocument of getPageDocuments()) {
      const element = Array.from(pageDocument.querySelectorAll(selector)).find(isVisible);
      if (element) return element;
    }
    return null;
  }

  function findVisibleMatching(selector, predicate) {
    for (const pageDocument of getPageDocuments()) {
      const element = Array.from(pageDocument.querySelectorAll(selector)).find(
        (candidate) => isVisible(candidate) && predicate(candidate),
      );
      if (element) return element;
    }
    return null;
  }

  function stopForInsufficientResources() {
    const toast = findVisibleMatching(
      "#toast[role='status']",
      (element) =>
        !element.hidden &&
        /thiếu\s+(?:thóc|gỗ)\b/i.test(element.textContent.trim()),
    );
    if (!toast || !isRunning) return false;

    isRunning = false;
    runGeneration += 1;
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    if (restaurantIntervalId !== null) {
      window.clearInterval(restaurantIntervalId);
      restaurantIntervalId = null;
    }
    if (ranchIntervalId !== null) {
      window.clearInterval(ranchIntervalId);
      ranchIntervalId = null;
    }
    if (ranchStartTimeoutId !== null) {
      window.clearTimeout(ranchStartTimeoutId);
      ranchStartTimeoutId = null;
    }
    updateControl();
    console.warn(
      `[AT-SP] Đã dừng tự động do thiếu tài nguyên: ${toast.textContent.trim()}`,
    );
    return true;
  }

  function shouldContinue(generation) {
    if (!isRunning || generation !== runGeneration) return false;
    if (activeFeatureKey && !isFeatureEnabled(activeFeatureKey)) return false;
    return !stopForInsufficientResources();
  }

  function waitFor(getElement, timeoutMs = 3_000, generation) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const poll = () => {
        if (!shouldContinue(generation)) {
          resolve(null);
          return;
        }
        const element = getElement();
        if (element || Date.now() >= deadline) {
          resolve(element);
          return;
        }
        window.setTimeout(poll, 100);
      };
      poll();
    });
  }

  function delay(milliseconds, generation) {
    return new Promise((resolve) => {
      window.setTimeout(
        () => resolve(shouldContinue(generation)),
        milliseconds,
      );
    });
  }

  function getVisibleDialog() {
    return findVisible("#dialog-form");
  }

  function isRestaurantDialog(dialog) {
    const title =
      dialog
        .querySelector("#dialog-title, .fm-head h3, h3")
        ?.textContent.trim() ?? "";
    return /quán ăn/i.test(title);
  }

  function closeNotificationDialog(dialog) {
    const notificationDialog = dialog?.closest(".fm-bell-dlg");
    if (!notificationDialog || !isVisible(notificationDialog)) {
      return;
    }

    const closeButton = Array.from(
      dialog.querySelectorAll(".dialog-actions button"),
    ).find(
      (button) =>
        button.textContent.trim() === "Đóng" &&
        !button.disabled &&
        isVisible(button),
    );

    if (!closeButton) {
      console.warn("[AT-SP] Không tìm thấy nút Đóng của danh sách thông báo.");
      return;
    }

    closeButton.click();
    console.info("[AT-SP] Đã đóng hộp thông báo để làm mới ở lần kiểm tra tiếp theo.");
  }

  async function serveReadyRestaurantGuests(generation) {
    const restaurantDialog = await waitFor(
      () => findVisibleMatching(".fm-sheet-dlg", isRestaurantDialog),
      5_000,
      generation,
    );
    if (!shouldContinue(generation)) return;
    if (!restaurantDialog) {
      console.warn(
        "[AT-SP] ⚠️ Thông báo báo khách phục vụ được ngay nhưng không mở được Quán ăn.",
      );
      return;
    }

    try {
      let servedCount = 0;
      while (shouldContinue(generation)) {
        const serveButton = findVisibleMatchingWithin(
          restaurantDialog,
          ".fm-list .fm-tools button.btn.primary",
          (button) =>
            /^Phục vụ$/i.test(button.textContent.trim()) && !button.disabled,
        );
        if (!serveButton) {
          console.info(
            `[AT-SP] 🍽️ Đã phục vụ ${servedCount} khách có nút primary.`,
          );
          return;
        }

        const guestLabel =
          serveButton.closest(".fm-ach")?.querySelector(".fm-item-name b")
            ?.textContent.trim() ?? "khách";
        serveButton.click();
        servedCount += 1;
        console.info(
          `[AT-SP] 🍽️ Đã bấm Phục vụ primary cho ${guestLabel}.`,
        );

        const actionUpdated = await waitFor(
          () =>
            !serveButton.isConnected ||
            serveButton.disabled ||
            !serveButton.classList.contains("primary"),
          3_000,
          generation,
        );
        if (!shouldContinue(generation)) return;
        if (!actionUpdated) {
          console.warn(
            `[AT-SP] ⚠️ Nút Phục vụ của ${guestLabel} chưa cập nhật; dừng để tránh bấm lặp.`,
          );
          return;
        }
        if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
      }
    } finally {
      const closeButton = findVisibleMatchingWithin(
        restaurantDialog,
        ".dialog-actions button",
        (button) =>
          button.textContent.trim() === "Đóng" && !button.disabled,
      );
      if (closeButton) {
        closeButton.click();
      } else if (isVisible(restaurantDialog)) {
        console.warn("[AT-SP] ⚠️ Không tìm thấy nút Đóng của Quán ăn.");
      }
    }
  }

  async function checkRestaurantService(generation) {
    if (
      !shouldContinue(generation) ||
      !isFeatureEnabled("villagers") ||
      isFeatureEnabled("games") ||
      isNeighborCheckActive ||
      isRestaurantCheckActive ||
      isRanchCheckActive ||
      isGameCheckActive ||
      activeCheckGeneration !== null ||
      getVisibleDialog()
    ) {
      return;
    }

    isRestaurantCheckActive = true;
    activeFeatureKey = "villagers";
    let restaurantDialog = null;
    const activeTab = findVisibleMatching(
      "button.tab[data-farm]",
      (tab) =>
        tab.classList.contains("active") ||
        tab.getAttribute("aria-selected") === "true",
    );
    const previousFarm = activeTab?.getAttribute("data-farm") ?? null;

    try {
      const homeTab = findVisibleMatching(
        "button.tab[data-farm='home']",
        (tab) => tab.getAttribute("aria-selected") !== "true",
      );
      if (homeTab) {
        homeTab.click();
        console.info("[AT-SP] Đã mở mục Vườn để kiểm tra Quán ăn.");
      }

      const restaurantSpot = await waitFor(
        () =>
          findVisibleMatching(
            "button.fh-spot[aria-label^='Quán ăn']",
            (button) => !button.disabled,
          ),
        3_000,
        generation,
      );
      if (!shouldContinue(generation)) return;
      if (!restaurantSpot) {
        console.warn("[AT-SP] Không tìm thấy điểm Quán ăn trong mục Vườn.");
        return;
      }

      restaurantSpot.click();
      restaurantDialog = await waitFor(
        () => findVisibleMatching(".fm-sheet-dlg", isRestaurantDialog),
        3_000,
        generation,
      );
      if (!shouldContinue(generation)) return;
      if (!restaurantDialog) {
        console.warn("[AT-SP] Không mở được hộp thoại Quán ăn.");
        return;
      }

      let servedCount = 0;
      while (shouldContinue(generation)) {
        const serveButton = findVisibleMatching(
          ".fm-sheet-dlg .fm-list .fm-tools button.btn.primary",
          (button) =>
            /^Phục vụ$/i.test(button.textContent.trim()) && !button.disabled,
        );
        if (!serveButton) {
          console.info(
            `[AT-SP] Đã phục vụ ${servedCount} khách; không còn nút Phục vụ primary.`,
          );
          return;
        }

        const guestLabel =
          serveButton.closest(".fm-ach")?.querySelector(".fm-item-name b")
            ?.textContent.trim() ?? "khách";
        serveButton.click();
        servedCount += 1;
        console.info(`[AT-SP] Đã bấm Phục vụ cho ${guestLabel}.`);

        const actionUpdated = await waitFor(
          () =>
            !serveButton.isConnected ||
            serveButton.disabled ||
            !serveButton.classList.contains("primary"),
          3_000,
          generation,
        );
        if (!shouldContinue(generation)) return;
        if (!actionUpdated) {
          console.warn(
            `[AT-SP] Nút Phục vụ của ${guestLabel} chưa cập nhật; dừng để tránh bấm lặp.`,
          );
          return;
        }
        if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
      }
    } finally {
      const currentRestaurantDialog = findVisibleMatching(
        ".fm-sheet-dlg",
        isRestaurantDialog,
      );
      if (currentRestaurantDialog) {
        const closeButton = Array.from(
          currentRestaurantDialog.querySelectorAll(".dialog-actions button"),
        ).find(
          (button) =>
            button.textContent.trim() === "Đóng" &&
            !button.disabled &&
            isVisible(button),
        );
        if (closeButton) {
          closeButton.click();
        } else {
          console.warn("[AT-SP] Không tìm thấy nút Đóng của hộp thoại Quán ăn.");
        }
      }

      if (
        previousFarm &&
        previousFarm !== "home" &&
        !getVisibleDialog()
      ) {
        const previousTab = findVisibleMatching(
          "button.tab[data-farm]",
          (tab) => tab.getAttribute("data-farm") === previousFarm,
        );
        previousTab?.click();
      } else if (previousFarm && previousFarm !== "home" && getVisibleDialog()) {
        console.warn("[AT-SP] Không quay lại tab trước vì hộp thoại vẫn đang mở.");
      }
      isRestaurantCheckActive = false;
      if (activeFeatureKey === "villagers") activeFeatureKey = null;
    }
  }

  async function handleMythicalActions(generation) {
    if (selectedMythicalBeast === NO_SELECTION_OPTION) {
      console.info("[AT-SP] Thần thú được đặt thành Không chọn; bỏ qua.");
      return;
    }

    if (
      !(await selectSeed(
        selectedMythicalBeast,
        "thú huyền thoại",
        generation,
      ))
    ) {
      return;
    }

    let clickCount = 0;
    while (shouldContinue(generation)) {
      const action = findVisibleMatching(
        ".fm-actions button.btn.small.primary:not(:disabled)",
        (button) =>
          MYTHICAL_ACTION_PATTERNS.some((pattern) =>
            pattern.test(button.textContent.trim()),
          ),
      );
      if (!action) {
        console.info("[AT-SP] Thần thú không có hành động nào đang bật.");
        return;
      }
      if (clickCount >= MAX_ANIMAL_ACTION_CLICKS) {
        console.warn(
          `[AT-SP] Đã dừng Thần thú sau ${MAX_ANIMAL_ACTION_CLICKS} lần bấm để tránh lặp vô hạn.`,
        );
        return;
      }

      const actionLabel = action.textContent.trim();
      action.click();
      clickCount += 1;
      console.info(`[AT-SP] Đã bấm hành động Thần thú: ${actionLabel}.`);

      const actionUpdated = await waitFor(
        () =>
          !action.isConnected ||
          action.disabled ||
          !action.classList.contains("primary"),
        3_000,
        generation,
      );
      if (!shouldContinue(generation)) return;
      if (!actionUpdated) {
        console.warn(
          `[AT-SP] Nút Thần thú "${actionLabel}" chưa cập nhật; dừng để tránh bấm lặp.`,
        );
        return;
      }
      if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
    }
  }

  async function checkRanchActions(generation) {
    if (
      !shouldContinue(generation) ||
      (!isFeatureEnabled("ranch") && !isFeatureEnabled("mythical")) ||
      isFeatureEnabled("games") ||
      isNeighborCheckActive ||
      isRestaurantCheckActive ||
      isRanchCheckActive ||
      isGameCheckActive ||
      activeCheckGeneration !== null ||
      getVisibleDialog()
    ) {
      return;
    }

    isRanchCheckActive = true;
    activeFeatureKey = isFeatureEnabled("ranch") ? "ranch" : "mythical";
    const activeTab = findVisibleMatching(
      "button.tab[data-farm]",
      (tab) =>
        tab.classList.contains("active") ||
        tab.getAttribute("aria-selected") === "true",
    );
    const previousFarm = activeTab?.getAttribute("data-farm") ?? null;

    try {
      const ranchTab = findVisibleMatching(
        "button.tab[data-farm='ranch']",
        (tab) => tab.getAttribute("aria-selected") !== "true",
      );
      if (ranchTab) {
        ranchTab.click();
      }

      const ranchIsActive = await waitFor(
        () =>
          findVisibleMatching(
            "button.tab[data-farm='ranch']",
            (tab) =>
              tab.classList.contains("active") ||
              tab.getAttribute("aria-selected") === "true",
          ),
        3_000,
        generation,
      );
      if (!shouldContinue(generation)) return;
      if (!ranchIsActive) {
        console.warn("[AT-SP] Không mở được mục Chuồng để kiểm tra.");
        return;
      }

      const mythicalSeedGroup = findVisibleMatching(
        ".fm-seeds[role='radiogroup'][aria-label='Chọn loại thú huyền thoại']",
        () => true,
      );
      if (mythicalSeedGroup) {
        if (!isFeatureEnabled("mythical")) {
          console.info("[AT-SP] Tự động Thần thú đang tắt.");
          return;
        }
        activeFeatureKey = "mythical";
        await handleMythicalActions(generation);
        return;
      }
      if (!isFeatureEnabled("ranch")) {
        console.info(
          "[AT-SP] Chưa mở giao diện Thần thú; bỏ qua vì tự động Chuồng đang tắt.",
        );
        return;
      }

      const primaryButtons = [];
      for (const pageDocument of getPageDocuments()) {
        primaryButtons.push(
          ...Array.from(
            pageDocument.querySelectorAll(
              ".fm-actions button.btn.primary:not(:disabled)",
            ),
          ).filter(isVisible),
        );
      }

      if (primaryButtons.length === 0) {
        console.info("[AT-SP] Chuồng không có nút primary đang bật.");
        return;
      }

      const selectedButton =
        primaryButtons[Math.floor(Math.random() * primaryButtons.length)];
      const actionLabel = selectedButton.textContent.trim();
      selectedButton.click();
      console.info(
        `[AT-SP] Đã bấm ngẫu nhiên một nút Chuồng (${primaryButtons.length} lựa chọn): ${actionLabel}.`,
      );

      const actionUpdated = await waitFor(
        () =>
          !selectedButton.isConnected ||
          selectedButton.disabled ||
          !selectedButton.classList.contains("primary"),
        3_000,
        generation,
      );
      if (!shouldContinue(generation)) return;
      if (!actionUpdated) {
        console.warn(
          `[AT-SP] Nút Chuồng "${actionLabel}" chưa cập nhật; sẽ không bấm lại cho đến lượt kiểm tra sau.`,
        );
      }
    } finally {
      if (previousFarm && previousFarm !== "ranch" && !getVisibleDialog()) {
        const previousTab = findVisibleMatching(
          "button.tab[data-farm]",
          (tab) => tab.getAttribute("data-farm") === previousFarm,
        );
        previousTab?.click();
      }
      isRanchCheckActive = false;
      if (activeFeatureKey === "ranch" || activeFeatureKey === "mythical") {
        activeFeatureKey = null;
      }
    }
  }

  function isAnimalAction(button) {
    return ANIMAL_ACTION_PATTERNS.some((pattern) =>
      pattern.test(button.textContent.trim()),
    );
  }

  function getAnimalActionType(button) {
    return ANIMAL_ACTION_PATTERNS.findIndex((pattern) =>
      pattern.test(button.textContent.trim()),
    );
  }

  async function handleAnimalTask(generation) {
    const actions = await waitFor(
      () =>
        findVisibleMatching(
          ".fm-actions button.btn.small",
          isAnimalAction,
        ),
      3_000,
      generation,
    );

    if (!shouldContinue(generation)) return;
    if (!actions) {
      console.warn("[AT-SP] Không tìm thấy các nút hành động của nhiệm vụ thú.");
      return;
    }

    const attemptedActionTypes = new Set();
    while (shouldContinue(generation)) {
      const enabledAction = findVisibleMatching(
        ".fm-actions button.btn.small",
        (button) => {
          const actionType = getAnimalActionType(button);
          return (
            actionType !== -1 &&
            !button.disabled &&
            !attemptedActionTypes.has(actionType)
          );
        },
      );

      if (!enabledAction) {
        console.info("[AT-SP] Đã thử tối đa một lần cho mỗi loại hành động thú.");
        return;
      }

      const actionType = getAnimalActionType(enabledAction);
      const originalLabel = enabledAction.textContent.trim();
      attemptedActionTypes.add(actionType);
      enabledAction.click();
      console.info("[AT-SP] Đã bấm hành động thú:", originalLabel);

      const uiUpdated = await waitFor(() => {
        const currentAction = findVisibleMatching(
          ".fm-actions button.btn.small",
          (button) => getAnimalActionType(button) === actionType,
        );
        return (
          !currentAction ||
          currentAction.disabled ||
          currentAction.textContent.trim() !== originalLabel
        );
      }, 3_000, generation);

      if (!shouldContinue(generation)) return;
      if (!uiUpdated) {
        console.warn(
          `[AT-SP] Nút "${originalLabel}" chưa cập nhật sau khi bấm; bỏ qua để tránh gửi lặp yêu cầu.`,
        );
      }
    }
  }

  async function handlePrimaryFarmActions(
    generation,
    taskLabel,
    shouldClickAction = () => true,
    prepareAction = async () => true,
  ) {
    const firstAction = await waitFor(
      () =>
        findVisibleMatching(
          ".fm-actions button.btn.primary, .fm-actions button.btn.small.primary",
          (button) => shouldClickAction(button),
        ),
      3_000,
      generation,
    );

    if (!shouldContinue(generation)) return;
    if (!firstAction) {
      console.warn(`[AT-SP] Không tìm thấy nút .btn.primary trong nhiệm vụ ${taskLabel}.`);
      return;
    }

    let clickCount = 0;
    while (shouldContinue(generation)) {
      const enabledAction = findVisibleMatching(
        ".fm-actions button.btn.primary, .fm-actions button.btn.small.primary",
        (button) => !button.disabled && shouldClickAction(button),
      );

      if (!enabledAction) {
        console.info(`[AT-SP] Đã xử lý xong nhiệm vụ ${taskLabel}; không còn nút primary đang bật.`);
        return;
      }

      if (clickCount >= MAX_ANIMAL_ACTION_CLICKS) {
        console.warn(
          `[AT-SP] Đã dừng nhiệm vụ ${taskLabel} sau ${MAX_ANIMAL_ACTION_CLICKS} lần bấm để tránh lặp vô hạn.`,
        );
        return;
      }

      if (!(await prepareAction(enabledAction))) return;
      if (!shouldContinue(generation)) return;

      enabledAction.click();
      clickCount += 1;
      console.info(`[AT-SP] Đã bấm nút nhiệm vụ ${taskLabel}:`, enabledAction.textContent.trim());

      if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
    }
  }

  async function handleRipeFields(generation) {
    const harvestButton = await waitFor(
      () =>
        findVisibleMatching(
          ".fm-actions button.btn.small.primary",
          (button) => /^Thu hết(?:\s*\(\d+\))?$/i.test(button.textContent.trim()),
        ),
      3_000,
      generation,
    );

    if (!shouldContinue(generation)) return;
    if (!harvestButton) {
      console.warn("[AT-SP] Không tìm thấy nút Thu hết sau khi mở nhiệm vụ ruộng chín.");
      return;
    }

    harvestButton.click();
    console.info("[AT-SP] Đã bấm Thu hết ruộng chín.");

    const sowButton = await waitFor(
      () =>
        findVisibleMatching(
          ".fm-actions button.btn.small.primary",
          (button) => /^Gieo\b/i.test(button.textContent.trim()),
        ),
      5_000,
      generation,
    );

    if (!shouldContinue(generation)) return;
    if (!sowButton) {
      console.warn("[AT-SP] Không tìm thấy nút Gieo đang bật sau khi thu hoạch ruộng.");
      return;
    }

    if (!(await selectSeed(selectedFieldCrop, "hạt ruộng", generation))) return;
    console.info("[AT-SP] Đang bấm các nút primary của ruộng cho đến khi hết.");
    await handlePrimaryFarmActions(generation, "ruộng");
  }

  async function handleReturnedExplorations(generation) {
    const firstClaim = await waitFor(
      () =>
        findVisibleMatching(
          ".fm-list .fm-ach.ready button.btn.primary",
          (button) =>
            /^Nhận$/i.test(button.textContent.trim()) && !button.disabled,
        ),
      3_000,
      generation,
    );

    if (!shouldContinue(generation)) return;
    if (!firstClaim) {
      console.warn("[AT-SP] Không tìm thấy nút Nhận đang bật trong chuyến khám phá.");
      return;
    }

    const claimButtons = [];
    for (const pageDocument of getPageDocuments()) {
      claimButtons.push(
        ...Array.from(
          pageDocument.querySelectorAll(
            ".fm-list .fm-ach.ready button.btn.primary",
          ),
        ).filter(
          (button) =>
            isVisible(button) &&
            !button.disabled &&
            /^Nhận$/i.test(button.textContent.trim()),
        ),
      );
    }

    let claimedCount = 0;
    for (const claimButton of claimButtons) {
      if (!shouldContinue(generation)) return;
      if (
        !claimButton.isConnected ||
        claimButton.disabled ||
        !isVisible(claimButton)
      ) {
        continue;
      }

      claimButton.click();
      claimedCount += 1;
      console.info(
        `[AT-SP] Đã nhận chuyến khám phá (${claimedCount}/${claimButtons.length}).`,
      );
      if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
    }

    console.info(`[AT-SP] Đã bấm nhận ${claimedCount} chuyến khám phá.`);

    const selectedPlaces = [
      ...new Set([
        selectedExplorationPlace,
        selectedExplorationPlaceSecond,
        selectedExplorationPlaceThird,
        ...EXPLORATION_PLACE_OPTIONS,
      ]),
    ];
    let startedCount = 0;

    for (const destination of selectedPlaces) {
      if (!shouldContinue(generation) || startedCount >= claimedCount) return;

      const alreadyExploring = getPageDocuments().some((pageDocument) =>
        Array.from(pageDocument.querySelectorAll(".fm-list .fm-ach:not(.fm-place)"))
          .map((card) =>
            card.querySelector(".fm-item-name b")?.textContent.trim() ?? "",
          )
          .some(
            (place) =>
              place.replace(/^Đang ở\s+/i, "").toLocaleLowerCase() ===
              destination.toLocaleLowerCase(),
          ),
      );
      if (alreadyExploring) {
        console.info(
          `[AT-SP] Bỏ qua ${destination} vì đã có chuyến đang đi tại đây.`,
        );
        continue;
      }

      const nextExploration = await waitFor(() => {
        for (const pageDocument of getPageDocuments()) {
          const destinationCard = Array.from(
            pageDocument.querySelectorAll(".fm-list .fm-ach.fm-place"),
          ).find(
            (card) =>
              card.querySelector(".fm-item-name b")?.textContent.trim() ===
              destination,
          );
          const goButton = destinationCard?.querySelector("button");

          if (
            goButton &&
            !goButton.disabled &&
            /^Đi$/i.test(goButton.textContent.trim()) &&
            isVisible(goButton)
          ) {
            return goButton;
          }
        }

        return null;
      }, 3_000, generation);

      if (!shouldContinue(generation)) return;
      if (!nextExploration) {
        console.warn(
          `[AT-SP] Không tìm thấy nút Đi đang bật cho địa điểm: ${destination}.`,
        );
        continue;
      }

      nextExploration.click();
      startedCount += 1;
      console.info(`[AT-SP] Đã bắt đầu chuyến khám phá tại ${destination}.`);
      if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
    }

    if (startedCount < claimedCount) {
      console.info(
        `[AT-SP] Đã bắt đầu ${startedCount}/${claimedCount} chuyến theo thứ tự ưu tiên.`,
      );
    }
  }

  async function handlePondTask(generation) {
    const pondCollectButton = await waitFor(
      () =>
        findVisibleMatching(
          ".fm-actions button.btn.small.primary",
          (button) => /^Vớt hết(?:\s*\(\d+\))?$/i.test(button.textContent.trim()),
        ),
      3_000,
      generation,
    );

    if (!shouldContinue(generation)) return;
    if (!pondCollectButton) {
      console.warn("[AT-SP] Không tìm thấy nút Vớt hết sau khi mở nhiệm vụ ao.");
      return;
    }
    if (pondCollectButton.disabled) {
      console.info("[AT-SP] Nút Vớt hết đang bị vô hiệu hóa.");
      return;
    }

    pondCollectButton.click();
    console.info("[AT-SP] Đã bấm nút Vớt hết của ao.");
    if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
    if (selectedPondFish === NO_SELECTION_OPTION) {
      console.info("[AT-SP] Ao được đặt thành Không chọn; không thả cá mới.");
      return;
    }

    const processedCells = new Set();
    let stockedCount = 0;

    while (shouldContinue(generation)) {
      const emptyPondCell = findVisibleMatching(
        ".fm-pond-cell.empty.art:not(:disabled)",
        (cell) => {
          const label = cell.getAttribute("aria-label") ?? cell.textContent.trim();
          return /thả giống/i.test(label) && !processedCells.has(label);
        },
      );

      if (!emptyPondCell) {
        console.info(
          `[AT-SP] Đã thả ${selectedPondFish} vào ${stockedCount} ô ao trống.`,
        );
        return;
      }

      const cellLabel =
        emptyPondCell.getAttribute("aria-label") ?? emptyPondCell.textContent.trim();
      processedCells.add(cellLabel);
      emptyPondCell.click();
      console.info("[AT-SP] Đã mở chọn giống:", cellLabel);

      const fishOption = await waitFor(
        () =>
          findVisibleMatching(
            "#dialog-form .fm-wear:not(:disabled)",
            (button) =>
              button.querySelector("b")?.textContent.trim().toLocaleLowerCase() ===
              selectedPondFish.toLocaleLowerCase(),
          ),
        3_000,
        generation,
      );

      if (!shouldContinue(generation)) return;
      if (!fishOption) {
        console.warn(
          `[AT-SP] Không tìm thấy tùy chọn ${selectedPondFish} cho ${cellLabel}.`,
        );
        return;
      }

      fishOption.click();
      stockedCount += 1;
      console.info(`[AT-SP] Đã chọn ${selectedPondFish}:`, cellLabel);
      if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
    }
  }

  async function startAvailableMachineRecipes(generation) {
    let clickCount = 0;
    const processedMachines = new Set();
    const machineReady = await waitFor(
      () =>
        findVisibleMatching(".fm-grid.machines .fm-machine.idle", (card) =>
          Array.from(
            card.querySelectorAll("button.btn.primary:not(:disabled)"),
          ).some(isVisible),
        ),
      MACHINE_RECIPE_READY_TIMEOUT_MS,
      generation,
    );
    if (!shouldContinue(generation)) return;
    if (!machineReady) {
      console.info("[AT-SP] Chưa có nút công thức xưởng khả dụng sau khi thu máy.");
      return;
    }

    while (shouldContinue(generation)) {
      const machine = findVisibleMatching(
        ".fm-grid.machines .fm-machine.idle",
        (card) => {
          const machineName =
            card.querySelector(".fm-machine-top b")?.textContent.trim() ?? "";
          return (
            Boolean(machineName) &&
            !processedMachines.has(machineName) &&
            getAvailableMachineRecipeButton(card) !== null
          );
        },
      );

      if (!machine) {
        console.info("[AT-SP] Đã xử lý các xưởng có nút primary đang bật.");
        return;
      }

      if (clickCount >= MAX_ANIMAL_ACTION_CLICKS) {
        console.warn("[AT-SP] Dừng chọn công thức sau 100 lần bấm để tránh lặp vô hạn.");
        return;
      }

      const machineName =
        machine.querySelector(".fm-machine-top b")?.textContent.trim() ?? "";
      const recipeButton = getAvailableMachineRecipeButton(machine);
      if (!recipeButton) {
        processedMachines.add(machineName);
        continue;
      }

      processedMachines.add(machineName);
      recipeButton.click();
      clickCount += 1;
      const recipeLabel = recipeButton.textContent.trim();
      const recipeStarted = await waitFor(
        () =>
          !machine.isConnected ||
          !machine.classList.contains("idle") ||
          recipeButton.disabled ||
          !recipeButton.classList.contains("primary"),
        3_000,
        generation,
      );
      if (!shouldContinue(generation)) return;
      if (recipeStarted) {
        console.info(
          "[AT-SP] Đã chọn trong xưởng:",
          machineName,
          recipeLabel,
        );
      } else {
        console.warn(
          `[AT-SP] Đã bấm "${recipeLabel}" ở ${machineName} nhưng trạng thái máy chưa đổi.`,
        );
      }
    }
  }

  function getAvailableMachineRecipeButton(machine) {
    if (!machine.classList.contains("idle")) return null;

    const primaryButtons = Array.from(
      machine.querySelectorAll("button.btn.primary:not(:disabled)"),
    ).filter(isVisible);
    if (primaryButtons.length === 0) return null;

    const machineName =
      machine.querySelector(".fm-machine-top .fm-rn")?.textContent.trim() ?? "";
    const machineOptions = WORKSHOP_MACHINE_OPTIONS.find(
      (option) =>
        option.label.toLocaleLowerCase() === machineName.toLocaleLowerCase(),
    );
    if (!machineOptions) return primaryButtons[0];

    if (
      !isFeatureEnabled(
        `${WORKSHOP_MACHINE_TOGGLE_PREFIX}${machineOptions.key}`,
      )
    ) {
      return null;
    }

    const getProductName = (button) =>
      button.querySelector(".fm-rn")?.textContent.trim() ||
      button.querySelector("img[alt]")?.alt.trim() ||
      "";

    const availableRecipes = primaryButtons.filter((button) =>
      machineOptions.products.some(
        (product) =>
          product.toLocaleLowerCase() ===
          getProductName(button).toLocaleLowerCase(),
      ),
    );
    const candidates =
      availableRecipes.length > 0 ? availableRecipes : primaryButtons;

    if (machineOptions.key === "medicineKiln") {
      const herbalTeaButton = candidates.find(
        (button) =>
          getProductName(button).toLocaleLowerCase() ===
          "trà thảo dược".toLocaleLowerCase(),
      );
      if (herbalTeaButton) return herbalTeaButton;
    }

    if (
      machineOptions.key === "forge" &&
      selectedForgeRecipe !== RANDOM_SELECTION_OPTION
    ) {
      const selectedButton = primaryButtons.find(
        (button) =>
          getProductName(button).toLocaleLowerCase() ===
          selectedForgeRecipe.toLocaleLowerCase(),
      );
      if (selectedButton) return selectedButton;
    }

    const recipeCounts = candidates
      .map((button) => {
        const countText =
          button.querySelector(".fm-rc")?.textContent.trim() ?? "";
        const countMatch = countText.match(/\(([\d\s.,]+)\)/);
        const count = countMatch
          ? Number.parseInt(countMatch[1].replace(/\D/g, ""), 10)
          : Number.NaN;
        return { button, count };
      })
      .filter(({ count }) => Number.isSafeInteger(count));
    if (recipeCounts.length === 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    const lowestCount = Math.min(...recipeCounts.map(({ count }) => count));
    const lowestCountRecipes = recipeCounts
      .filter(({ count }) => count === lowestCount)
      .map(({ button }) => button);
    return lowestCountRecipes[
      Math.floor(Math.random() * lowestCountRecipes.length)
    ];
  }

  function getNeighborHelpFeature(cell) {
    const description = [
      cell.getAttribute("aria-label") ?? "",
      cell.querySelector(".fm-tray-label")?.textContent.trim() ?? "",
    ].join(" ");

    if (/tưới(?:\s+nước)?\s+giúp/i.test(description)) return "neighborWater";
    if (/(?:phun|tưới)\s+ẩm\s+giúp/i.test(description)) {
      return "neighborHumidity";
    }
    if (/nhổ\s+cỏ\s+giúp/i.test(description)) return "neighborWeed";
    if (/tỉa\s+cành\s+giúp/i.test(description)) return "neighborPrune";
    if (/ủ\s+phân\s+giúp/i.test(description)) return "neighborCompost";
    if (/cho\s+ăn\s+giúp/i.test(description)) return "neighborFeed";
    if (/cho\s+tằm\s+ăn/i.test(description)) return "neighborSilkworm";
    return null;
  }

  function getNeighborName(button) {
    return (
      button.querySelector(".fm-item-name b")?.textContent
        .trim()
        .replace(/^⭐\s*/u, "") ||
      button.querySelector("[aria-label^='Xem nhân vật']")?.getAttribute("aria-label")
        ?.replace(/^Xem nhân vật\s*/i, "") ||
      ""
    );
  }

  function getAvailableNeighborHelpCell(attemptedCellKeys) {
    const pageDocuments = getPageDocuments();
    for (const [documentIndex, pageDocument] of pageDocuments.entries()) {
      const trays = pageDocument.querySelectorAll(".fm-trays");
      for (const [trayIndex, tray] of Array.from(trays).entries()) {
        const cells = Array.from(tray.querySelectorAll(".fm-tray-cell"));
        for (const [cellIndex, cell] of cells.entries()) {
          const featureKey = getNeighborHelpFeature(cell);
          const cellLabel =
            cell.getAttribute("aria-label") ??
            cell.querySelector(".fm-tray-label")?.textContent.trim() ??
            "";
          const cellKey =
            `${documentIndex}:${trayIndex}:${cellIndex}:${cellLabel}`;
          if (
            featureKey &&
            isFeatureEnabled(featureKey) &&
            !cell.disabled &&
            isVisible(cell) &&
            !attemptedCellKeys.has(cellKey)
          ) {
            return { cell, featureKey, cellKey };
          }
        }
      }
    }

    return null;
  }

  function getNeighborWaterPlotDescription(plot) {
    const labels = [
      plot.getAttribute("aria-label") ?? "",
      plot.getAttribute("title") ?? "",
      plot.textContent ?? "",
      ...Array.from(plot.querySelectorAll("[aria-label], [title]")).flatMap(
        (element) => [
          element.getAttribute("aria-label") ?? "",
          element.getAttribute("title") ?? "",
        ],
      ),
    ];
    return labels.join(" ");
  }

  function getAvailableFieldPestPlot() {
    for (const pageDocument of getPageDocuments()) {
      const plots = pageDocument.querySelectorAll(".fm-field .fm-plot");
      for (const plot of plots) {
        const description = [
          plot.getAttribute("aria-label") ?? "",
          plot.getAttribute("title") ?? "",
          plot.textContent ?? "",
        ].join(" ");
        if (
          !plot.disabled &&
          isVisible(plot) &&
          (plot.classList.contains("care-pest") || /sâu/i.test(description))
        ) {
          return plot;
        }
      }
    }

    return null;
  }

  async function handleFieldPestTask(generation) {
    const pestPlot = await waitFor(getAvailableFieldPestPlot, 3_000, generation);
    if (!shouldContinue(generation)) return;
    if (!pestPlot) {
      console.warn("[AT-SP] Không tìm thấy ô ruộng có sâu sau khi mở nhiệm vụ.");
      return;
    }

    const plotLabel =
      pestPlot.getAttribute("aria-label")?.trim() ||
      pestPlot.textContent.trim() ||
      "Ô ruộng có sâu";
    pestPlot.click();
    console.info(`[AT-SP] Đã mở ô ruộng có sâu: ${plotLabel}.`);
  }

  function getAvailableHomeWeedCell(attemptedCellKeys) {
    for (const [documentIndex, pageDocument] of getPageDocuments().entries()) {
      const trays = pageDocument.querySelectorAll(".fm-trays");
      for (const [trayIndex, tray] of Array.from(trays).entries()) {
        const cells = Array.from(tray.querySelectorAll(".fm-tray-cell"));
        for (const [cellIndex, cell] of cells.entries()) {
          const description = [
            cell.getAttribute("aria-label") ?? "",
            cell.querySelector(".fm-tray-label")?.textContent.trim() ?? "",
          ].join(" ");
          const cellKey =
            `${documentIndex}:${trayIndex}:${cellIndex}:${description}`;
          if (
            !attemptedCellKeys.has(cellKey) &&
            !cell.disabled &&
            isVisible(cell) &&
            /cỏ mọc|nhổ\s+cỏ/i.test(description)
          ) {
            return { cell, cellKey, description };
          }
        }
      }
    }

    return null;
  }

  async function handleHomeWeedTask(generation) {
    const attemptedCellKeys = new Set();
    let availableCell = await waitFor(
      () => getAvailableHomeWeedCell(attemptedCellKeys),
      3_000,
      generation,
    );
    if (!shouldContinue(generation)) return;
    if (!availableCell) {
      console.warn("[AT-SP] Không tìm thấy ô cỏ mọc trong vườn nhà.");
      return;
    }

    let removedWeeds = 0;
    while (availableCell && shouldContinue(generation)) {
      const { cell, cellKey, description } = availableCell;
      attemptedCellKeys.add(cellKey);
      activeFeatureKey = "homeWeed";
      cell.click();

      const actionUpdated = await waitFor(
        () =>
          !cell.isConnected ||
          cell.disabled ||
          !/cỏ mọc|nhổ\s+cỏ/i.test(
            [
              cell.getAttribute("aria-label") ?? "",
              cell.querySelector(".fm-tray-label")?.textContent.trim() ?? "",
            ].join(" "),
          ),
        2_500,
        generation,
      );
      if (!shouldContinue(generation)) return;
      if (actionUpdated) {
        removedWeeds += 1;
        console.info(`[AT-SP] Đã nhổ cỏ vườn nhà: ${description}.`);
      } else {
        console.warn(
          `[AT-SP] Ô "${description}" chưa cập nhật sau khi nhổ cỏ; bỏ qua để tránh bấm lặp.`,
        );
      }

      activeFeatureKey = null;
      if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
      availableCell = getAvailableHomeWeedCell(attemptedCellKeys);
    }

    console.info(`[AT-SP] Đã nhổ cỏ ở ${removedWeeds} ô trong vườn nhà.`);
  }

  function getVietnamMinuteOfDay() {
    const timeParts = VIETNAM_TIME_FORMATTER.formatToParts(new Date());
    const hourPart = timeParts.find((part) => part.type === "hour");
    const minutePart = timeParts.find((part) => part.type === "minute");
    if (!hourPart || !minutePart) {
      throw new Error("[AT-SP] Không xác định được giờ Việt Nam hiện tại.");
    }
    return Number(hourPart.value) * 60 + Number(minutePart.value);
  }

  function isAutomationScheduleAllowedNow() {
    if (!isFeatureEnabled(AUTOMATION_SCHEDULE_TOGGLE_KEY)) return true;

    const minuteOfDay = getVietnamMinuteOfDay();
    return (
      minuteOfDay < 60 ||
      minuteOfDay >= DAYTIME_RESTRICTION_END_MINUTE ||
      (minuteOfDay >= 5 * 60 &&
        minuteOfDay < DAYTIME_RESTRICTION_START_MINUTE)
    );
  }

  function isNeighborWaterAllowedNow() {
    return isAutomationScheduleAllowedNow();
  }

  function getAvailableNeighborWaterPlot(attemptedPlotKeys) {
    if (
      !isFeatureEnabled("neighborWater") ||
      !isNeighborWaterAllowedNow()
    ) {
      return null;
    }

    for (const [documentIndex, pageDocument] of getPageDocuments().entries()) {
      const fields = pageDocument.querySelectorAll(".fm-field");
      for (const [fieldIndex, field] of Array.from(fields).entries()) {
        const plots = field.querySelectorAll(".fm-plot");
        for (const [plotIndex, plot] of Array.from(plots).entries()) {
          const plotKey = [
            documentIndex,
            fieldIndex,
            plot.getAttribute("data-plot") ??
            plot.getAttribute("aria-label") ??
            plotIndex,
          ].join(":");
          if (
            !attemptedPlotKeys.has(plotKey) &&
            !plot.disabled &&
            isVisible(plot) &&
            /tưới/i.test(getNeighborWaterPlotDescription(plot))
          ) {
            return { plot, plotKey };
          }
        }
      }
    }

    return null;
  }

  function getAvailableNeighborPestPlot(attemptedPlotKeys) {
    if (!isFeatureEnabled("neighborPest")) return null;

    for (const [documentIndex, pageDocument] of getPageDocuments().entries()) {
      const fields = pageDocument.querySelectorAll(".fm-field");
      for (const [fieldIndex, field] of Array.from(fields).entries()) {
        const plots = field.querySelectorAll(".fm-plot.help");
        for (const [plotIndex, plot] of Array.from(plots).entries()) {
          const plotKey = [
            documentIndex,
            fieldIndex,
            plot.getAttribute("data-plot") ??
              plot.getAttribute("aria-label") ??
              plotIndex,
          ].join(":");
          if (
            !attemptedPlotKeys.has(plotKey) &&
            !plot.disabled &&
            isVisible(plot) &&
            (plot.classList.contains("care-pest") ||
              /sâu/i.test(getNeighborWaterPlotDescription(plot)))
          ) {
            return { plot, plotKey };
          }
        }
      }
    }

    return null;
  }

  function getAvailableNeighborFeedTargets() {
    const targets = [];
    for (const pageDocument of getPageDocuments()) {
      const pens = pageDocument.querySelectorAll(
        ".fm-visit-pen[aria-label='Chuồng']",
      );
      for (const pen of pens) {
        const markedElements = Array.from(
          pen.querySelectorAll(
            "button, [role='button'], .fm-visit-feed, .fm-tag, [aria-label]",
          ),
        ).filter((element) => {
          const description = [
            element.getAttribute("aria-label") ?? "",
            element.textContent ?? "",
          ].join(" ");
          return (
            element.classList.contains("fm-visit-feed") ||
            /ăn\s+hộ/i.test(description) ||
            description.includes("🍽")
          );
        });

        for (const markedElement of markedElements) {
          const target =
            markedElement.closest("button, [role='button'], .fm-visit-feed") ??
            markedElement.parentElement ??
            markedElement;
          if (
            !target.disabled &&
            isVisible(target) &&
            !targets.includes(target)
          ) {
            targets.push(target);
          }
        }
      }
    }
    return targets;
  }

  function shouldContinueNeighborHelp(generation) {
    return shouldContinue(generation) && isAutomationScheduleAllowedNow();
  }

  async function checkNeighborHelp(generation) {
    if (
      !shouldContinueNeighborHelp(generation) ||
      !AUTOMATION_FEATURE_GROUPS.at(-1).features.some((feature) =>
        isFeatureEnabled(feature.key),
      ) ||
      isNeighborCheckActive ||
      isRestaurantCheckActive ||
      isRanchCheckActive ||
      isGameCheckActive ||
      activeCheckGeneration !== null ||
      findVisible(".fm-visit-bar") ||
      getVisibleDialog()
    ) {
      return;
    }

    isNeighborCheckActive = true;
    let visitStarted = false;
    let neighborName = "";

    try {
      const friendsTab = findVisibleMatching(
        "button.tab[data-farm='friends']",
        (tab) =>
          tab.classList.contains("active") ||
          tab.getAttribute("aria-selected") === "true",
      );
      if (!friendsTab) {
        const friendsTabButton = findVisibleMatching(
          "button.tab[data-farm='friends']",
          (tab) => !tab.disabled,
        );
        if (!friendsTabButton) {
          console.warn("[AT-SP] Không tìm thấy tab Hàng xóm để kiểm tra hỗ trợ.");
          return;
        }
        friendsTabButton.click();
      }

      const neighborListReady = await waitFor(
        () =>
          findVisibleMatching(
            "button.fm-neighbor",
            (button) => Boolean(button.querySelector(".fm-nb-tag.help")),
          ) ??
          findVisibleMatching("button.tab[data-farm='friends']", (tab) =>
            tab.classList.contains("active"),
          ),
        3_000,
        generation,
      );
      if (!shouldContinueNeighborHelp(generation)) return;
      if (!neighborListReady) {
        console.warn("[AT-SP] Không tải được danh sách Hàng xóm.");
        return;
      }

      const now = Date.now();
      for (const [name, retryAt] of neighborRetryAfter) {
        if (retryAt <= now) neighborRetryAfter.delete(name);
      }

      const neighborButton = findVisibleMatching(
        "button.fm-neighbor",
        (button) => {
          const helpTag = button.querySelector(".fm-nb-tag.help");
          const helpCount = Number.parseInt(helpTag?.textContent ?? "", 10);
          const name = getNeighborName(button);
          const needsHelp =
            helpTag !== null &&
            /\bcần\s+giúp\b/i.test(helpTag.textContent) &&
            Number.isFinite(helpCount) &&
            helpCount > 0;
          const needsFeedCheck =
            isFeatureEnabled("neighborFeed") && Boolean(name);
          return (
            (needsHelp || needsFeedCheck) &&
            (!name || !neighborRetryAfter.has(name))
          );
        },
      );
      if (!neighborButton) return;

      neighborName = getNeighborName(neighborButton);
      neighborButton.click();
      visitStarted = true;
      console.info(
        `[AT-SP] Đang mở vườn hàng xóm${neighborName ? ` ${neighborName}` : ""} để giúp.`,
      );

      const visitReady = await waitFor(
        () =>
          findVisibleMatching(".fm-visit-head", () => true) &&
          findVisibleMatching(".fm-visit-bar", () => true),
        5_000,
        generation,
      );
      if (!shouldContinueNeighborHelp(generation)) return;
      if (!visitReady) {
        console.warn("[AT-SP] Không tải được vườn hàng xóm.");
        return;
      }

      const attemptedCellKeys = new Set();
      const attemptedPlotKeys = new Set();
      let helpedCount = 0;
      while (
        isFeatureEnabled("neighborFeed") &&
        shouldContinueNeighborHelp(generation)
      ) {
        const feedTargets = getAvailableNeighborFeedTargets();
        if (feedTargets.length === 0) break;

        const feedTarget = feedTargets[0];
        const actionLabel =
          feedTarget.getAttribute("aria-label")?.trim() ||
          feedTarget.textContent.trim() ||
          "Cho thú ăn hộ";
        activeFeatureKey = "neighborFeed";
        feedTarget.click();

        const actionUpdated = await waitFor(
          () => getAvailableNeighborFeedTargets().length < feedTargets.length,
          2_500,
          generation,
        );
        if (!shouldContinueNeighborHelp(generation)) return;
        if (!actionUpdated) {
          console.warn(
            `[AT-SP] Nút "${actionLabel}" chưa cập nhật; bỏ qua để tránh bấm lặp.`,
          );
          activeFeatureKey = null;
          break;
        }

        helpedCount += 1;
        console.info(
          `[AT-SP] Đã cho thú ăn giúp ${neighborName || "hàng xóm"}: ${actionLabel}.`,
        );
        activeFeatureKey = null;
      }

      while (shouldContinueNeighborHelp(generation)) {
        const availablePlot = getAvailableNeighborWaterPlot(attemptedPlotKeys);
        if (!availablePlot) break;

        const { plot, plotKey } = availablePlot;
        const actionLabel = getNeighborWaterPlotDescription(plot).trim();
        attemptedPlotKeys.add(plotKey);
        activeFeatureKey = "neighborWater";
        plot.click();

        const actionUpdated = await waitFor(
          () =>
            !plot.isConnected ||
            plot.disabled ||
            !/tưới/i.test(getNeighborWaterPlotDescription(plot)),
          2_500,
          generation,
        );
        if (!shouldContinueNeighborHelp(generation)) return;
        if (actionUpdated) {
          helpedCount += 1;
          console.info(
            `[AT-SP] Đã tưới giúp ${neighborName || "hàng xóm"} tại ô ruộng: ${actionLabel}.`,
          );
        } else {
          console.warn(
            `[AT-SP] Ô ruộng "${actionLabel}" chưa cập nhật sau khi bấm; bỏ qua để tránh bấm lặp.`,
          );
        }
        activeFeatureKey = null;
        if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
      }

      while (shouldContinueNeighborHelp(generation)) {
        const availablePlot =
          getAvailableNeighborPestPlot(attemptedPlotKeys);
        if (!availablePlot) break;

        const { plot, plotKey } = availablePlot;
        const actionLabel = getNeighborWaterPlotDescription(plot).trim();
        attemptedPlotKeys.add(plotKey);
        activeFeatureKey = "neighborPest";
        plot.click();

        const actionUpdated = await waitFor(
          () =>
            !plot.isConnected ||
            plot.disabled ||
            !plot.classList.contains("help") ||
            !plot.classList.contains("care-pest"),
          2_500,
          generation,
        );
        if (!shouldContinueNeighborHelp(generation)) return;
        if (actionUpdated) {
          helpedCount += 1;
          console.info(
            `[AT-SP] Đã bắt sâu giúp ${neighborName || "hàng xóm"} tại ô ruộng: ${actionLabel}.`,
          );
        } else {
          console.warn(
            `[AT-SP] Ô ruộng "${actionLabel}" chưa cập nhật sau khi bắt sâu; bỏ qua để tránh bấm lặp.`,
          );
        }
        activeFeatureKey = null;
        if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
      }

      while (shouldContinueNeighborHelp(generation)) {
        const availableHelp = getAvailableNeighborHelpCell(attemptedCellKeys);
        if (!availableHelp) break;

        const { cell, featureKey, cellKey } = availableHelp;
        const actionLabel =
          cell.querySelector(".fm-tray-label")?.textContent.trim() ??
          cell.getAttribute("aria-label") ??
          featureKey;
        const wasBlocked = cell.classList.contains("blocked");
        attemptedCellKeys.add(cellKey);
        activeFeatureKey = featureKey;
        cell.click();

        const actionUpdated = await waitFor(
          () =>
            !cell.isConnected ||
            cell.disabled ||
            !isVisible(cell) ||
            (wasBlocked && !cell.classList.contains("blocked")) ||
            getNeighborHelpFeature(cell) !== featureKey,
          2_500,
          generation,
        );
        if (!shouldContinueNeighborHelp(generation)) return;
        if (actionUpdated) {
          helpedCount += 1;
          console.info(
            `[AT-SP] Đã hỗ trợ ${neighborName || "hàng xóm"}: ${actionLabel}.`,
          );
        } else {
          console.warn(
            `[AT-SP] Ô "${actionLabel}" chưa cập nhật; bỏ qua để tránh bấm lặp.`,
          );
        }
        activeFeatureKey = null;
        if (!(await delay(ACTION_CLICK_DELAY_MS, generation))) return;
      }

      if (helpedCount === 0) {
        console.info(
          `[AT-SP] Không có ô hỗ trợ đang bật${neighborName ? ` tại vườn ${neighborName}` : ""}.`,
        );
      }
    } finally {
      activeFeatureKey = null;
      if (visitStarted) {
        const listButton = findVisibleMatching(
          ".fm-visit-bar button.btn",
          (button) => /danh sách/i.test(button.textContent.trim()),
        );
        if (listButton) {
          listButton.click();
          await waitFor(
            () => findVisible("button.fm-neighbor"),
            3_000,
            generation,
          );
        } else if (findVisible(".fm-visit-bar")) {
          console.warn("[AT-SP] Không tìm thấy nút quay lại danh sách Hàng xóm.");
        }
        if (neighborName) {
          neighborRetryAfter.set(
            neighborName,
            Date.now() + NEIGHBOR_RETRY_COOLDOWN_MS,
          );
        }
      }
      isNeighborCheckActive = false;
    }
  }

  async function checkNotifications(generation) {
    if (!shouldContinue(generation)) return;
    if (isNeighborCheckActive || isRestaurantCheckActive || isRanchCheckActive) return;
    if (activeCheckGeneration === generation) return;
    activeCheckGeneration = generation;

    let dialog = null;
    try {
      dialog = getVisibleDialog();
      if (!dialog) {
        const bellButton = await waitFor(
          () => findVisible("button.fm-bell[aria-label='Thông báo'], .fm-bell"),
          1_000,
          generation,
        );

        if (!shouldContinue(generation)) return;
        if (!bellButton) {
          console.warn(
            "[AT-SP] Chưa thấy nút .fm-bell; sẽ thử lại ở lượt quét tiếp theo.",
          );
          return;
        }
        bellButton.click();
        dialog = await waitFor(getVisibleDialog, 3_000, generation);
      }

      if (!shouldContinue(generation)) return;
      if (!dialog) {
        console.warn("[AT-SP] Không mở được danh sách thông báo.");
        return;
      }

      const notificationRows = Array.from(
        dialog.querySelectorAll(".fm-bell-list .fm-bell-row"),
      );
      const taskRow =
        (isFeatureEnabled("villagers")
          ? notificationRows.find((row) => {
            const message =
              row.querySelector("span")?.textContent?.trim() ?? "";
            return RESTAURANT_READY_TASK_PATTERN.test(message);
          })
          : null) ??
        notificationRows.find((row) => {
          const message = row.querySelector("span")?.textContent?.trim() ?? "";
          const featureKey = getTaskFeature(message);
          return featureKey !== null && isFeatureEnabled(featureKey);
        });

      if (!taskRow) {
        if (Date.now() - lastNoTaskLogAt >= 30_000) {
          console.info("[AT-SP] Không có nhiệm vụ cá nhân đang chờ.");
          lastNoTaskLogAt = Date.now();
        }
        return;
      }

      const taskName = taskRow.querySelector("span")?.textContent?.trim() ?? "";
      activeFeatureKey = getTaskFeature(taskName);
      console.info("[AT-SP] Đang mở nhiệm vụ:", taskName);
      if (!shouldContinue(generation)) return;
      taskRow.click();

      if (FIELD_CARE_TASK_PATTERN.test(taskName)) {
        await handleFieldPestTask(generation);
        return;
      }

      if (MYTHICAL_HUNGRY_TASK_PATTERN.test(taskName)) {
        if (selectedMythicalBeast === NO_SELECTION_OPTION) {
          console.info("[AT-SP] Thần thú được đặt thành Không chọn; bỏ qua cho ăn.");
          return;
        }

        const mythicalSeedGroup = findVisible(
          ".fm-seeds[role='radiogroup'][aria-label='Chọn loại thú huyền thoại']",
        );
        if (
          mythicalSeedGroup &&
          !(await selectSeed(
            selectedMythicalBeast,
            "thú huyền thoại",
            generation,
          ))
        ) {
          return;
        }

        const feedButton = await waitFor(
          () =>
            findVisibleMatching(
              ".fm-actions button.btn.small.primary:not(:disabled)",
              (button) =>
                /^Cho ăn hết(?:\s*\(\d+\))?$/i.test(button.textContent.trim()),
            ),
          3_000,
          generation,
        );
        if (!shouldContinue(generation)) return;
        if (!feedButton) {
          console.warn("[AT-SP] Không tìm thấy nút Cho ăn hết của Thần thú.");
          return;
        }

        const actionLabel = feedButton.textContent.trim();
        feedButton.click();
        console.info(`[AT-SP] Đã bấm nút Thần thú: ${actionLabel}.`);
        const actionUpdated = await waitFor(
          () =>
            !feedButton.isConnected ||
            feedButton.disabled ||
            !feedButton.classList.contains("primary") ||
            feedButton.textContent.trim() !== actionLabel,
          3_000,
          generation,
        );
        if (!shouldContinue(generation)) return;
        if (!actionUpdated) {
          console.warn(
            `[AT-SP] Nút Thần thú "${actionLabel}" chưa cập nhật; dừng để tránh bấm lặp.`,
          );
        }
        return;
      }

      if (RESTAURANT_READY_TASK_PATTERN.test(taskName)) {
        await serveReadyRestaurantGuests(generation);
        return;
      }

      if (RIPE_FIELD_TASK_PATTERN.test(taskName)) {
        await handleRipeFields(generation);
        return;
      }

      if (RETURNED_EXPLORATION_TASK_PATTERN.test(taskName)) {
        await handleReturnedExplorations(generation);
        return;
      }

      if (
        ANIMAL_TASK_PATTERN.test(taskName) ||
        ANIMAL_CARE_TASK_PATTERN.test(taskName)
      ) {
        await handleAnimalTask(generation);
        return;
      }

      if (POND_TASK_PATTERN.test(taskName)) {
        await handlePondTask(generation);
        return;
      }

      if (SICK_ANIMAL_TASK_PATTERN.test(taskName)) {
        await handlePrimaryFarmActions(generation, "chữa thú ốm");
        return;
      }

      if (COMPOST_TASK_PATTERN.test(taskName)) {
        await handlePrimaryFarmActions(generation, "ủ phân");
        return;
      }

      if (DRY_COMPOST_PIT_TASK_PATTERN.test(taskName)) {
        await handlePrimaryFarmActions(generation, "hố phân khô");
        return;
      }

      if (FLOWER_TASK_PATTERN.test(taskName)) {
        await handlePrimaryFarmActions(
          generation,
          "luống hoa",
          () => true,
          async (button) => {
            if (!/^(?:Gieo|Trồng)\b/i.test(button.textContent.trim())) {
              return true;
            }
            return selectSeed(selectedFlowerCrop, "hạt hoa", generation);
          },
        );
        return;
      }

      if (WEED_TASK_PATTERN.test(taskName)) {
        await handleHomeWeedTask(generation);
        return;
      }

      if (HERB_GARDEN_DONE_TASK_PATTERN.test(taskName)) {
        await handlePrimaryFarmActions(
          generation,
          "vườn thuốc",
          () => true,
          async (button) => {
            if (!/^(?:Gieo|Trồng)\b/i.test(button.textContent.trim())) {
              return true;
            }
            return selectSeed(selectedMedicineCrop, "hạt thuốc", generation);
          },
        );
        return;
      }

      if (FOREST_DONE_TASK_PATTERN.test(taskName)) {
        await handlePrimaryFarmActions(
          generation,
          "rừng",
          () => true,
          async (button) => {
            if (!/^(?:Gieo|Trồng)\b/i.test(button.textContent.trim())) {
              return true;
            }
            return selectSeed(selectedForestCrop, "loại rừng trồng", generation);
          },
        );
        return;
      }

      if (DRYING_RACK_TASK_PATTERN.test(taskName)) {
        await handlePrimaryFarmActions(generation, "giá khô");
        return;
      }

      if (SILKWORM_DONE_TASK_PATTERN.test(taskName)) {
        await handlePrimaryFarmActions(
          generation,
          "thu nong nuôi tằm",
          (button) =>
            /^Thu hết(?:\s*\(\d+\))?$/i.test(button.textContent.trim()),
        );
        await handlePrimaryFarmActions(
          generation,
          "bắt đầu nuôi tằm",
          (button) =>
            /^Bắt đầu hết(?:\s*\(\d+\))?$/i.test(button.textContent.trim()),
        );
        return;
      }

      if (MUSHROOM_HOUSE_DONE_TASK_PATTERN.test(taskName)) {
        await handlePrimaryFarmActions(
          generation,
          "nhà nấm",
          (button) => !/^Gieo hết\b/i.test(button.textContent.trim()),
          async (button) => {
            if (!/^(?:Gieo|Trồng)\b/i.test(button.textContent.trim())) {
              return true;
            }
            return selectSeed(selectedMushroomCrop, "giống nấm", generation);
          },
        );
        return;
      }

      if (MACHINE_TASK_PATTERN.test(taskName)) {
        const machineCollectButton = await waitFor(
          () =>
            findVisibleMatching(
              ".fm-actions button.btn.small.primary",
              (button) => /^Lấy hết(?:\s*\(\d+\))?$/i.test(button.textContent.trim()),
            ),
          3_000,
          generation,
        );

        if (!shouldContinue(generation)) return;
        if (!machineCollectButton) {
          console.warn("[AT-SP] Không tìm thấy nút Lấy hết sau khi mở nhiệm vụ máy.");
          return;
        }
        if (machineCollectButton.disabled) {
          console.info("[AT-SP] Nút Lấy hết đang bị vô hiệu hóa.");
          return;
        }

        machineCollectButton.click();
        console.info("[AT-SP] Đã bấm nút Lấy hết của máy.");
        closeNotificationDialog(dialog);
        dialog = null;
        if (!(await delay(MACHINE_RESTART_DELAY_MS, generation))) return;
        await startAvailableMachineRecipes(generation);
        return;
      }

      if (FRUIT_TASK_PATTERN.test(taskName)) {
        const harvestButton = await waitFor(
          () =>
            findVisibleMatching(
              "button.bth.small.primary, button.btn.small.primary",
              (button) => /^Hái hết(?:\s*\(\d+\))?$/i.test(button.textContent.trim()),
            ),
          5_000,
          generation,
        );

        if (!shouldContinue(generation)) return;
        if (!harvestButton) {
          console.warn("[AT-SP] Không tìm thấy nút Hái hết sau khi mở nhiệm vụ cây.");
          return;
        }
        if (harvestButton.disabled) {
          console.info("[AT-SP] Nút Hái hết đang bị vô hiệu hóa.");
          return;
        }

        harvestButton.click();
        console.info("[AT-SP] Đã bấm nút Hái hết.");
        return;
      }

      if (DELIVERY_TASK_PATTERN.test(taskName)) {
        const deliverButton = await waitFor(
          () =>
            findVisibleMatching(
              ".fm-order-foot button.btn",
              (button) =>
                /^Giao$/i.test(button.textContent.trim()) && !button.disabled,
            ),
          3_000,
          generation,
        );

        if (!shouldContinue(generation)) return;
        if (!deliverButton) {
          console.warn("[AT-SP] Không tìm thấy nút Giao đang bật trong danh sách đơn hàng.");
          return;
        }

        deliverButton.click();
        console.info("[AT-SP] Đã bấm nút Giao.");
        return;
      }

      const collectButton = await waitFor(() =>
        findVisibleMatching(
          "button.bth.small.primary, button.btn.small.primary",
          (button) => /Lấy mật(?:\s*\(\d+\))?/i.test(button.textContent.trim()),
        ),
        3_000,
        generation,
      );

      if (!shouldContinue(generation)) return;
      if (!collectButton) {
        console.warn("[AT-SP] Không tìm thấy nút Lấy mật sau khi mở nhiệm vụ.");
        return;
      }

      if (collectButton.disabled) {
        console.warn("[AT-SP] Nút Lấy mật đang bị vô hiệu hóa.");
        return;
      }

      collectButton.click();
      console.info("[AT-SP] Đã bấm nút Lấy mật.");
    } finally {
      closeNotificationDialog(dialog);
      if (activeCheckGeneration === generation) {
        activeCheckGeneration = null;
        activeFeatureKey = null;
      }
    }
  }

  function getGameBoard(kind) {
    const selectors = {
      match: ".fm-match",
      memory: ".fm-memory",
      quiz: ".fm-game:not(.fg-result)",
    };
    return findVisibleMatching(selectors[kind], () => true);
  }

  function getGameResult() {
    return findVisibleMatching(".fm-game.fg-result", () => true);
  }

  function getGameReplayButton(result = getGameResult()) {
    if (!result) return null;
    return findVisibleMatchingWithin(
      result,
      ".fg-result-btns button, button",
      (button) =>
        !button.disabled && /chơi\s*lại/i.test(button.textContent.trim()),
    );
  }

  function findVisibleMatchingWithin(root, selector, predicate) {
    const candidate = Array.from(root.querySelectorAll(selector)).find(
      (element) => isVisible(element) && predicate(element),
    );
    return candidate ?? null;
  }

  function findGameCard(gameName) {
    return findVisibleMatching(".fm-ach.fm-game-card", (card) => {
      const name = card.querySelector(".fm-item-name b")?.textContent ?? "";
      return name.toLocaleLowerCase().includes(gameName.toLocaleLowerCase());
    });
  }

  function getGamePlayButton(card) {
    return findVisibleMatchingWithin(
      card,
      "button",
      (button) =>
        !button.disabled &&
        /^chơi(?:\s|$)/i.test(button.textContent.trim()) &&
        !/hết lượt/i.test(button.textContent.trim()),
    );
  }

  async function switchToVillageForGames(generation) {
    const villageTab = findVisibleMatching(
      "button.tab[data-farm='village']",
      (tab) =>
        tab.classList.contains("active") ||
        tab.getAttribute("aria-selected") === "true",
    );
    if (villageTab) return true;

    const villageTabButton = findVisibleMatching(
      "button.tab[data-farm='village']",
      (tab) => !tab.disabled,
    );
    if (!villageTabButton) {
      console.warn("[AT-SP] Không tìm thấy tab Làng để kiểm tra trò chơi.");
      return false;
    }

    villageTabButton.click();
    return Boolean(
      await waitFor(
        () =>
          findVisibleMatching("button.tab[data-farm='village']", (tab) =>
            tab.classList.contains("active") ||
            tab.getAttribute("aria-selected") === "true",
          ),
        3_000,
        generation,
      ),
    );
  }

  async function openFarmGame(kind, gameName, generation) {
    let board = getGameBoard(kind);
    if (board) return board;

    const resumeButton =
      kind === "quiz"
        ? findVisibleMatching(".fm-game-resume button", () => true)
        : null;
    if (resumeButton) {
      resumeButton.click();
    } else {
      const card = findGameCard(gameName);
      if (!card) {
        console.info(`[AT-SP] Không tìm thấy trò chơi ${gameName}; bỏ qua.`);
        return null;
      }

      const playButton = getGamePlayButton(card);
      if (!playButton) {
        if (Date.now() - lastNoGameOptionsLogAt >= 30_000) {
          console.info(
            `[AT-SP] Trò ${gameName} không còn lượt hoặc nút Chơi chưa bật; chuyển trò tiếp theo.`,
          );
          lastNoGameOptionsLogAt = Date.now();
        }
        return null;
      }
      playButton.click();
      console.info(`[AT-SP] Đã mở trò chơi ${gameName}.`);
    }

    board = await waitFor(() => getGameBoard(kind), 12_000, generation);
    if (!board) {
      console.warn(`[AT-SP] Không thấy bàn chơi ${gameName} sau khi mở.`);
      return null;
    }

    if (kind === "quiz") {
      const startButton = findVisibleMatchingWithin(
        board,
        "button",
        (button) =>
          /^(bắt đầu|chơi ngay|vào chơi|tiếp tục)$/i.test(
            button.textContent.trim(),
          ),
      );
      if (startButton && !board.querySelector(".fm-quiz-q")) {
        startButton.click();
      }
    }

    return board;
  }

  async function replayFarmGame(kind, gameName, round, generation) {
    const result = await waitFor(() => getGameResult(), 7_000, generation);
    if (!result) return null;

    const summary =
      result.querySelector(".fm-note")?.textContent.trim() || "Đã hoàn thành.";
    console.info(`[AT-SP] ${gameName}, ván ${round}: ${summary}`);
    const replayButton = getGameReplayButton(result);
    if (!replayButton) {
      console.info(`[AT-SP] ${gameName} đã hết lượt chơi lại.`);
      const closeButton = findVisibleMatchingWithin(
        result,
        "button",
        (button) =>
          !button.disabled &&
          /^(đóng|xong|về làng|quay lại)$/i.test(button.textContent.trim()),
      );
      if (closeButton) {
        closeButton.click();
        await waitFor(
          () => !getGameResult() && findGameCard(gameName),
          5_000,
          generation,
        );
      }
      return null;
    }

    console.info(
      `[AT-SP] Đang chơi lại ${gameName}: ${replayButton.textContent.trim()}.`,
    );
    replayButton.click();
    const nextBoard = await waitFor(
      () => (!getGameResult() ? getGameBoard(kind) : null),
      12_000,
      generation,
    );
    if (!nextBoard) {
      console.warn(`[AT-SP] Không thấy bàn ${gameName} mới sau khi chơi lại.`);
      return null;
    }
    return nextBoard;
  }

  function readMatchGrid(board) {
    const buttons = Array.from(board.querySelectorAll("button.fm-gem")).filter(
      isVisible,
    );
    if (buttons.length !== 36) {
      throw new Error(
        `Ghép 3 cần bàn 6 × 6; hiện đọc được ${buttons.length} ô.`,
      );
    }
    const values = buttons.map((button) => button.textContent.trim());
    if (values.some((value) => !value)) {
      throw new Error("Có ô Ghép 3 không đọc được nội dung.");
    }
    return { buttons, values };
  }

  function scoreMatchGrid(values) {
    const matched = new Set();
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        const index = row * 6 + column;
        const value = values[index];
        if (!value) continue;

        if (
          column <= 3 &&
          values[index + 1] === value &&
          values[index + 2] === value
        ) {
          for (let current = column; current < 6; current += 1) {
            if (values[row * 6 + current] !== value) break;
            matched.add(row * 6 + current);
          }
        }
        if (
          row <= 3 &&
          values[index + 6] === value &&
          values[index + 12] === value
        ) {
          for (let current = row; current < 6; current += 1) {
            if (values[current * 6 + column] !== value) break;
            matched.add(current * 6 + column);
          }
        }
      }
    }
    return matched.size;
  }

  function chooseMatchMove(values) {
    let bestMove = null;
    for (let index = 0; index < 36; index += 1) {
      const neighbors = [];
      if (index % 6 < 5) neighbors.push(index + 1);
      if (index < 30) neighbors.push(index + 6);

      for (const neighbor of neighbors) {
        if (values[index] === values[neighbor]) continue;
        const nextValues = values.slice();
        [nextValues[index], nextValues[neighbor]] = [
          nextValues[neighbor],
          nextValues[index],
        ];
        const score = scoreMatchGrid(nextValues);
        if (score > 0 && (!bestMove || score > bestMove.score)) {
          bestMove = { first: index, second: neighbor, score };
        }
      }
    }
    return bestMove;
  }

  async function playMatchGame(generation, board) {
    let round = 1;
    let moveCount = 0;
    let idleScans = 0;

    while (shouldContinue(generation)) {
      const result = getGameResult();
      if (result) {
        const nextBoard = await replayFarmGame(
          "match",
          "Ghép 3 nông sản",
          round,
          generation,
        );
        if (!nextBoard) return;
        board = nextBoard;
        round += 1;
        moveCount = 0;
        idleScans = 0;
        continue;
      }

      board = getGameBoard("match") ?? board;
      if (!board || !board.isConnected) {
        await delay(100, generation);
        continue;
      }

      const { buttons, values } = readMatchGrid(board);
      const move = chooseMatchMove(values);
      if (!move) {
        idleScans += 1;
        if (idleScans >= 8) {
          console.warn(
            "[AT-SP] Không tìm thấy nước Ghép 3 hợp lệ sau 8 lần đọc bàn; chuyển trò tiếp theo.",
          );
          return;
        }
        await delay(100, generation);
        continue;
      }

      idleScans = 0;
      const previousGrid = values.join("");
      buttons[move.first].click();
      if (!(await delay(140, generation))) return;
      const liveBoard = getGameBoard("match");
      if (!liveBoard) continue;
      const liveButtons = Array.from(
        liveBoard.querySelectorAll("button.fm-gem"),
      ).filter(isVisible);
      if (liveButtons.length !== 36) continue;
      liveButtons[move.second].click();
      moveCount += 1;
      console.info(
        `[AT-SP] Ghép 3, ván ${round}: đổi ô ${move.first + 1} ↔ ${move.second + 1}; dự kiến ghép ${move.score} ô (lượt ${moveCount}).`,
      );

      await waitFor(
        () => {
          const currentBoard = getGameBoard("match");
          if (!currentBoard) return getGameResult();
          const currentGrid = Array.from(
            currentBoard.querySelectorAll("button.fm-gem"),
          )
            .filter(isVisible)
            .map((button) => button.textContent.trim())
            .join("");
          return currentGrid && currentGrid !== previousGrid
            ? currentBoard
            : null;
        },
        2_000,
        generation,
      );
      if (!(await delay(100, generation))) return;
    }
  }

  async function playMemoryGame(generation, board) {
    let round = 1;
    while (shouldContinue(generation)) {
      const cards = Array.from(
        board.querySelectorAll("button.fm-card-flip[data-v]"),
      ).filter(isVisible);
      const pairs = new Map();
      for (const card of cards) {
        const value = card.getAttribute("data-v");
        if (!pairs.has(value)) pairs.set(value, []);
        pairs.get(value).push(card);
      }
      if (
        cards.length !== 16 ||
        pairs.size !== 8 ||
        Array.from(pairs.values()).some((pair) => pair.length !== 2)
      ) {
        console.warn(
          `[AT-SP] Lật bài: bàn không đúng cấu trúc 8 cặp (đọc ${cards.length} thẻ); chuyển trò tiếp theo.`,
        );
        return;
      }

      console.info(`[AT-SP] Lật bài, ván ${round}: đọc đủ 8 cặp từ data-v.`);
      let completedPairs = 0;
      for (const [value, pair] of pairs) {
        if (!shouldContinue(generation)) return;
        const positions = pair.map((card) => cards.indexOf(card));
        for (const position of positions) {
          const currentBoard = getGameBoard("memory");
          if (!currentBoard) {
            if (getGameResult()) break;
            console.warn("[AT-SP] Bàn Lật bài đã đóng bất ngờ.");
            return;
          }
          const currentCards = Array.from(
            currentBoard.querySelectorAll("button.fm-card-flip[data-v]"),
          ).filter(isVisible);
          const card = currentCards[position];
          if (
            !card ||
            card.getAttribute("data-v") !== value
          ) {
            console.warn(
              `[AT-SP] Bàn Lật bài thay đổi ở ô ${position + 1}; dừng để tránh lật nhầm.`,
            );
            return;
          }
          if (
            !card.classList.contains("up") &&
            !card.classList.contains("matched") &&
            !card.classList.contains("done")
          ) {
            card.click();
            if (!(await delay(450, generation))) return;
          }
        }

        if (getGameResult()) break;
        if (!(await delay(900, generation))) return;
        completedPairs += 1;
        console.info(
          `[AT-SP] Lật bài, ván ${round}: hoàn thành ${completedPairs}/8 cặp.`,
        );
      }

      if (getGameResult()) {
        const nextBoard = await replayFarmGame(
          "memory",
          "Lật bài trí nhớ",
          round,
          generation,
        );
        if (!nextBoard) return;
        board = nextBoard;
        round += 1;
        continue;
      }

      const result = await waitFor(() => getGameResult(), 7_000, generation);
      if (!result && completedPairs !== 8) {
        console.warn(
          `[AT-SP] Lật bài chưa hiện kết quả sau ${completedPairs}/8 cặp; chuyển trò tiếp theo.`,
        );
        return;
      }
      if (!result) return;
      const nextBoard = await replayFarmGame(
        "memory",
        "Lật bài trí nhớ",
        round,
        generation,
      );
      if (!nextBoard) return;
      board = nextBoard;
      round += 1;
    }
  }

  function getQuizQuestion(board) {
    const question = board.querySelector(".fm-quiz-q");
    const answers = Array.from(
      board.querySelectorAll("button.fm-quiz-a"),
    )
      .filter(isVisible)
      .map((button, index) => ({
        index,
        text: button.textContent.trim(),
        button,
      }));
    if (!question?.textContent.trim() || answers.length < 2) return null;
    return {
      question: question.textContent.trim(),
      answers,
      note: board.querySelector(".fm-note")?.textContent.trim() ?? "",
    };
  }

  function requestGeminiAnswer(apiKey, model, question) {
    const choices = question.answers
      .map((answer, index) => `${index + 1}. ${answer.text}`)
      .join("\n");
    const prompt = [
      "Bạn là trợ lý trả lời câu hỏi kiến thức nông nghiệp phổ thông bằng tiếng Việt.",
      "Chọn đúng một đáp án tốt nhất trong danh sách.",
      `Câu hỏi: ${question.question}`,
      `Các lựa chọn:\n${choices}`,
      "Trả về JSON: index là số thứ tự bắt đầu từ 0, answer là nội dung đáp án, reason giải thích ngắn.",
    ].join("\n\n");

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        data: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                index: { type: "INTEGER" },
                answer: { type: "STRING" },
                reason: { type: "STRING" },
              },
              required: ["index", "answer", "reason"],
            },
          },
        }),
        timeout: 30_000,
        onload: (response) => {
          let data;
          try {
            data = JSON.parse(response.responseText || "{}");
          } catch (error) {
            reject(new Error(`Gemini trả về JSON không hợp lệ: ${error.message}`));
            return;
          }
          if (response.status < 200 || response.status >= 300) {
            const error = new Error(
              data.error?.message || `Gemini HTTP ${response.status}`,
            );
            error.status = response.status;
            reject(error);
            return;
          }
          try {
            const text =
              data.candidates?.[0]?.content?.parts
                ?.map((part) => part.text || "")
                .join("") || "";
            if (!text) throw new Error("Gemini không trả về nội dung.");
            resolve(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()));
          } catch (error) {
            reject(error);
          }
        },
        onerror: () =>
          reject(new Error("Không kết nối được Gemini API.")),
        ontimeout: () =>
          reject(new Error("Gemini API quá thời gian chờ 30 giây.")),
      });
    });
  }

  async function answerFarmQuiz(question, apiKey) {
    let lastError = null;
    for (const model of GAME_GEMINI_MODEL_FALLBACKS) {
      try {
        const answer = await requestGeminiAnswer(apiKey, model, question);
        console.info(`[AT-SP] Đố vui: nhận đáp án từ ${model}.`);
        return answer;
      } catch (error) {
        lastError = error;
        const mayTryFallback =
          [400, 404, 429, 500, 502, 503, 504].includes(error.status);
        if (!mayTryFallback) throw error;
        console.warn(
          `[AT-SP] Gemini ${model} không khả dụng/quota hiện tại; thử model kế tiếp.`,
          error.message,
        );
      }
    }
    throw new Error(
      `Các model Gemini dự phòng đều không khả dụng: ${lastError?.message ?? "không rõ lỗi"}`,
    );
  }

  async function playQuizGame(generation, board, apiKey) {
    let round = 1;
    let lastQuestion = "";

    while (shouldContinue(generation)) {
      if (getGameResult()) {
        const nextBoard = await replayFarmGame(
          "quiz",
          "Đố vui nhà nông",
          round,
          generation,
        );
        if (!nextBoard) return;
        board = nextBoard;
        round += 1;
        lastQuestion = "";
        continue;
      }

      board = getGameBoard("quiz") ?? board;
      const question = getQuizQuestion(board);
      if (!question) {
        const nextState = await waitFor(
          () => getGameResult() || getQuizQuestion(getGameBoard("quiz") ?? board),
          15_000,
          generation,
        );
        if (!nextState) {
          console.warn("[AT-SP] Không xuất hiện câu hỏi trong 15 giây; dừng Đố vui.");
          return;
        }
        continue;
      }

      const fingerprint = `${question.question}|${question.answers
        .map((answer) => answer.text)
        .join("|")}`;
      if (fingerprint === lastQuestion) {
        const changedQuestion = await waitFor(() => {
          const current = getGameQuestionFingerprint();
          return current && current !== lastQuestion ? current : null;
        }, 12_000, generation);
        if (!changedQuestion) {
          console.warn("[AT-SP] Đố vui không chuyển câu; dừng lượt hiện tại.");
          return;
        }
        continue;
      }

      lastQuestion = fingerprint;
      const answer = await answerFarmQuiz(question, apiKey);
      if (!shouldContinue(generation)) return;
      const index = Number(answer.index);
      if (!Number.isInteger(index) || index < 0 || index >= question.answers.length) {
        throw new Error(`Gemini trả về index không hợp lệ: ${answer.index}`);
      }
      let selectedAnswer = question.answers[index];
      if (answer.answer) {
        const matchingAnswer = question.answers.find(
          (candidate) =>
            candidate.text.toLocaleLowerCase() ===
            String(answer.answer).trim().toLocaleLowerCase(),
        );
        if (matchingAnswer) selectedAnswer = matchingAnswer;
      }
      selectedAnswer.button.click();
      console.info(
        `[AT-SP] Đố vui, ván ${round}: chọn "${selectedAnswer.text}"${answer.reason ? ` — ${answer.reason}` : ""}.`,
      );
      const questionChanged = await waitFor(
        () =>
          getGameResult() ||
          (getGameQuestionFingerprint() &&
            getGameQuestionFingerprint() !== fingerprint),
        15_000,
        generation,
      );
      if (!questionChanged) {
        console.warn("[AT-SP] Đố vui chưa chuyển câu sau khi chọn đáp án.");
        return;
      }
      if (getGameResult()) continue;
      lastQuestion = "";
    }
  }

  function getGameQuestionFingerprint() {
    const board = getGameBoard("quiz");
    const question = board && getQuizQuestion(board);
    if (!question) return "";
    return `${question.question}|${question.answers
      .map((answer) => answer.text)
      .join("|")}`;
  }

  async function checkFarmGames(generation) {
    if (
      !shouldContinue(generation) ||
      !isFeatureEnabled("games") ||
      Date.now() < nextGameCheckAfter ||
      isGameCheckActive ||
      isNeighborCheckActive ||
      isRestaurantCheckActive ||
      isRanchCheckActive ||
      activeCheckGeneration !== null ||
      findVisible(".fm-visit-bar") ||
      getVisibleDialog()
    ) {
      return;
    }

    isGameCheckActive = true;
    activeFeatureKey = "games";
    const activeTab = findVisibleMatching(
      "button.tab[data-farm]",
      (tab) =>
        tab.classList.contains("active") ||
        tab.getAttribute("aria-selected") === "true",
    );
    const previousFarm = activeTab?.getAttribute("data-farm") ?? null;

    try {
      const activeBoards = [
        ["match", "Ghép 3 nông sản"],
        ["memory", "Lật bài trí nhớ"],
        ["quiz", "Đố vui nhà nông"],
      ];
      const currentGame = activeBoards.find(([kind]) => getGameBoard(kind));
      if (currentGame) {
        const [kind] = currentGame;
        if (kind === "match") {
          await playMatchGame(generation, getGameBoard(kind));
        } else if (kind === "memory") {
          await playMemoryGame(generation, getGameBoard(kind));
        } else {
          const apiKey = GM_getValue(GAME_GEMINI_KEY_STORAGE_KEY, "").trim();
          if (!apiKey) {
            if (Date.now() - lastMissingGameKeyLogAt >= 30_000) {
              console.warn(
                "[AT-SP] Chưa lưu Gemini API key; bỏ qua Đố vui nhà nông.",
              );
              lastMissingGameKeyLogAt = Date.now();
            }
          } else {
            await playQuizGame(generation, getGameBoard(kind), apiKey);
          }
        }
        return;
      }

      if (!(await switchToVillageForGames(generation))) return;
      const prioritizedGames = [
        ["match", "Ghép 3 nông sản"],
        ["memory", "Lật bài trí nhớ"],
        ["quiz", "Đố vui nhà nông"],
      ];
      let anyGameFound = false;
      for (const [kind, gameName] of prioritizedGames) {
        if (!shouldContinue(generation)) return;
        if (kind === "quiz" && !GM_getValue(GAME_GEMINI_KEY_STORAGE_KEY, "").trim()) {
          if (Date.now() - lastMissingGameKeyLogAt >= 30_000) {
            console.info(
              "[AT-SP] Bỏ qua Đố vui nhà nông vì chưa cấu hình Gemini API key.",
            );
            lastMissingGameKeyLogAt = Date.now();
          }
          continue;
        }

        const board = await openFarmGame(kind, gameName, generation);
        if (!board) continue;
        anyGameFound = true;
        if (kind === "match") {
          await playMatchGame(generation, board);
        } else if (kind === "memory") {
          await playMemoryGame(generation, board);
        } else {
          const apiKey = GM_getValue(GAME_GEMINI_KEY_STORAGE_KEY, "").trim();
          if (apiKey) await playQuizGame(generation, board, apiKey);
        }
        if (getGameBoard(kind) || getGameResult()) return;
      }

      if (!anyGameFound) {
        nextGameCheckAfter = Date.now() + 30_000;
        if (Date.now() - lastNoGameOptionsLogAt >= 30_000) {
          console.info(
            "[AT-SP] Các trò chơi hiện không có lượt khả dụng (chờ 30s kiểm tra lại hoặc bạn có thể gạt tắt Trò chơi để tiếp tục làm nông).",
          );
          lastNoGameOptionsLogAt = Date.now();
        }
      }
    } catch (error) {
      console.warn("[AT-SP] Tự động trò chơi gặp lỗi:", error);
    } finally {
      if (
        previousFarm &&
        previousFarm !== "village" &&
        !getVisibleDialog() &&
        !findVisible(".fm-game:not(.fg-result)")
      ) {
        const previousTab = findVisibleMatching(
          "button.tab[data-farm]",
          (tab) => tab.getAttribute("data-farm") === previousFarm,
        );
        previousTab?.click();
      }
      activeFeatureKey = null;
      isGameCheckActive = false;
    }
  }

  async function runPriorityCycle(generation) {
    if (!shouldContinue(generation) || isPriorityCycleActive) return;

    isPriorityCycleActive = true;
    try {
      await checkNeighborHelp(generation);
      if (shouldContinue(generation)) {
        await checkNotifications(generation);
      }
      if (isFeatureEnabled("games")) {
        if (shouldContinue(generation)) await checkFarmGames(generation);
      }
    } finally {
      isPriorityCycleActive = false;
    }
  }

  const controlPanel = document.createElement("section");
  function setCompactSpacing(element, padding = "0") {
    element.style.setProperty("margin", "0", "important");
    element.style.setProperty("padding", padding, "important");
    element.style.setProperty("box-sizing", "border-box");
  }

  controlPanel.setAttribute("aria-label", "Điều khiển tự động nông trại");
  Object.assign(controlPanel.style, {
    position: "fixed",
    left: "8px",
    right: "auto",
    bottom: "16px",
    zIndex: "2147483647",
    display: "grid",
    gap: "7px",
    boxSizing: "border-box",
    width: "min(260px, calc(100vw - 16px))",
    maxHeight: "calc(100vh - 16px)",
    overflowY: "auto",
    padding: "5px",
    border: "1px solid #dce8dd",
    borderRadius: "12px",
    color: "#203528",
    background: "linear-gradient(145deg, #ffffff, #f3f8f2)",
    font: "500 13px system-ui, sans-serif",
    boxShadow: "0 10px 32px #183b2540",
  });
  setCompactSpacing(controlPanel, "5px");

  const panelHeader = document.createElement("div");
  Object.assign(panelHeader.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "28px",
    padding: "0",
    borderBottom: "1px solid #e4ece4",
    cursor: "grab",
    touchAction: "none",
    userSelect: "none",
  });
  const dragIcon = document.createElement("span");
  dragIcon.textContent = "⠿";
  dragIcon.setAttribute("aria-hidden", "true");
  Object.assign(dragIcon.style, {
    color: "#60816a",
    fontSize: "16px",
    lineHeight: "1",
  });
  const panelHeading = document.createElement("div");
  Object.assign(panelHeading.style, {
    display: "flex",
    alignItems: "center",
    flex: "1",
  });
  const panelTitle = document.createElement("strong");
  panelTitle.textContent = "Farm automation";
  panelTitle.style.fontSize = "12px";
  panelHeading.append(panelTitle);

  const updateLink = document.createElement("a");
  updateLink.href =
    "https://raw.githubusercontent.com/thanhnguyenduyy/lazy-warriors-farm-auto/refs/heads/main/script.user.js";
  updateLink.target = "_blank";
  updateLink.rel = "noopener noreferrer";
  updateLink.setAttribute("aria-label", "Cập nhật userscript");
  updateLink.title = "Cập nhật userscript";
  Object.assign(updateLink.style, {
    display: "grid",
    placeItems: "center",
    flex: "0 0 22px",
    width: "22px",
    height: "22px",
    color: "#60816a",
    textDecoration: "none",
    cursor: "pointer",
  });
  const updateIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  updateIcon.setAttribute("width", "16");
  updateIcon.setAttribute("height", "16");
  updateIcon.setAttribute("viewBox", "0 0 24 24");
  updateIcon.setAttribute("fill", "none");
  updateIcon.setAttribute("stroke", "currentColor");
  updateIcon.setAttribute("stroke-width", "2");
  updateIcon.setAttribute("stroke-linecap", "round");
  updateIcon.setAttribute("stroke-linejoin", "round");
  updateIcon.setAttribute("aria-hidden", "true");
  for (const pathData of [
    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
    "m7 10 5 5 5-5",
    "M12 15V3",
  ]) {
    const path = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path.setAttribute("d", pathData);
    updateIcon.append(path);
  }
  updateLink.append(updateIcon);

  const expandButton = document.createElement("button");
  expandButton.type = "button";
  expandButton.textContent = "⭐";
  expandButton.setAttribute("aria-label", "Mở bảng điều khiển");
  expandButton.setAttribute("aria-expanded", "false");
  expandButton.title = "Mở bảng điều khiển";
  Object.assign(expandButton.style, {
    display: "grid",
    placeItems: "center",
    flex: "0 0 27px",
    width: "27px",
    height: "27px",
    padding: "0",
    border: "0",
    background: "transparent",
    color: "#e5a900",
    font: "20px/1 system-ui, sans-serif",
    cursor: "pointer",
    lineHeight: "1",
  });
  panelHeader.append(dragIcon, panelHeading, updateLink, expandButton);

  const panelContent = document.createElement("div");
  Object.assign(panelContent.style, {
    display: "none",
    gap: "4px",
    margin: "0",
    padding: "0",
  });
  setCompactSpacing(panelContent);

  const commonSettings = document.createElement("div");
  Object.assign(commonSettings.style, {
    display: "grid",
    gap: "5px",
    margin: "0",
    padding: "0",
  });
  setCompactSpacing(commonSettings);

  const control = document.createElement("button");
  control.type = "button";
  control.setAttribute("aria-pressed", "false");
  Object.assign(control.style, {
    width: "100%",
    minHeight: "32px",
    margin: "0",
    padding: "6px 8px",
    border: "0",
    borderRadius: "10px",
    color: "#fff",
    background: "#157347",
    font: "700 13px system-ui, sans-serif",
    cursor: "pointer",
    boxShadow: "0 3px 8px #15734733",
  });
  setCompactSpacing(control, "6px 8px");

  const intervalControl = document.createElement("label");
  intervalControl.textContent = "Kiểm tra: ";
  Object.assign(intervalControl.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    minHeight: "28px",
    margin: "0",
    color: "#425849",
    font: "600 12px system-ui, sans-serif",
  });
  setCompactSpacing(intervalControl);

  const intervalSelect = document.createElement("select");
  intervalSelect.setAttribute("aria-label", "Chu kỳ kiểm tra");
  Object.assign(intervalSelect.style, {
    minWidth: "112px",
    margin: "0",
    padding: "5px 7px",
    border: "1px solid #d5e1d6",
    borderRadius: "8px",
    background: "#fff",
    color: "#263c2d",
    font: "12px system-ui, sans-serif",
  });
  setCompactSpacing(intervalSelect, "5px 7px");

  for (const seconds of [1, 2, 5, 0.5]) {
    const option = document.createElement("option");
    option.value = String(seconds);
    option.textContent = `${seconds} giây`;
    intervalSelect.append(option);
  }
  intervalControl.append(intervalSelect);

  commonSettings.append(control, intervalControl);

  const settingsTabs = document.createElement("div");
  settingsTabs.setAttribute("role", "tablist");
  settingsTabs.setAttribute("aria-label", "Khu vực cài đặt tự động");
  Object.assign(settingsTabs.style, {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "3px",
    margin: "0",
    padding: "2px",
    borderRadius: "9px",
    background: "#eaf1ea",
  });
  setCompactSpacing(settingsTabs, "2px");
  const settingsPanels = document.createElement("div");
  Object.assign(settingsPanels.style, {
    margin: "0",
    padding: "0",
  });
  setCompactSpacing(settingsPanels);
  const tabEntries = [];

  function createSettingsTab(label, panel, selected = false) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(selected));
    tab.textContent = label;
    Object.assign(tab.style, {
      minWidth: "0",
      margin: "0",
      padding: "5px 2px",
      border: "0",
      borderRadius: "7px",
      color: selected ? "#fff" : "#53675a",
      background: selected ? "#25834d" : "transparent",
      font: "700 10px system-ui, sans-serif",
      whiteSpace: "nowrap",
      cursor: "pointer",
    });
    setCompactSpacing(tab, "5px 2px");
    tab.setAttribute("aria-controls", panel.id);
    settingsTabs.append(tab);
    const entry = { tab, panel };
    tabEntries.push(entry);
    return entry;
  }

  let currentTabEntry = null;
  const commonPanel = document.createElement("div");
  commonPanel.setAttribute("role", "tabpanel");
  commonPanel.id = "at-sp-settings-general";
  Object.assign(commonPanel.style, {
    display: "block",
    margin: "0",
    padding: "0",
  });
  setCompactSpacing(commonPanel);
  commonPanel.append(commonSettings);
  currentTabEntry = createSettingsTab("Chung", commonPanel, true);
  settingsPanels.append(commonPanel);

  const plantingControl = document.createElement("div");
  Object.assign(plantingControl.style, {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "3px 6px",
    margin: "0",
    padding: "4px",
    border: "1px solid #e3ebe2",
    borderRadius: "8px",
    background: "#fff",
    font: "600 11px system-ui, sans-serif",
  });
  setCompactSpacing(plantingControl, "4px");

  const pondControl = document.createElement("div");
  Object.assign(pondControl.style, {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "3px 6px",
    margin: "0",
    padding: "4px",
    border: "1px solid #e3ebe2",
    borderRadius: "8px",
    background: "#fff",
    font: "600 11px system-ui, sans-serif",
  });
  setCompactSpacing(pondControl, "4px");

  const workshopControl = document.createElement("div");
  Object.assign(workshopControl.style, {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "4px 5px",
    margin: "0",
    padding: "4px",
    border: "1px solid #e3ebe2",
    borderRadius: "8px",
    background: "#fff",
    font: "600 11px system-ui, sans-serif",
  });
  setCompactSpacing(workshopControl, "4px");

  const mythicalControl = document.createElement("div");
  Object.assign(mythicalControl.style, {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "3px",
    margin: "0",
    padding: "4px",
    border: "1px solid #e3ebe2",
    borderRadius: "8px",
    background: "#fff",
    font: "600 11px system-ui, sans-serif",
  });
  setCompactSpacing(mythicalControl, "4px");

  function createCropSelect(
    labelText,
    ariaLabel,
    options,
    selectedValue,
    onChange,
    targetContainer = plantingControl,
  ) {
    const row = document.createElement("label");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "3px",
      minWidth: "0",
      minHeight: "24px",
      margin: "0",
      padding: "0",
      color: "#425849",
      fontSize: "11px",
      cursor: "pointer",
    });
    setCompactSpacing(row);

    const labelSpan = document.createElement("span");
    labelSpan.textContent = labelText;
    Object.assign(labelSpan.style, {
      flex: "0 0 auto",
      fontSize: "10.5px",
      fontWeight: "600",
      whiteSpace: "nowrap",
    });
    row.append(labelSpan);

    const optionControl = document.createElement("span");
    Object.assign(optionControl.style, {
      display: "flex",
      alignItems: "center",
      gap: "2px",
      flex: "1 1 auto",
      minWidth: "0",
      margin: "0",
      padding: "0",
    });
    setCompactSpacing(optionControl);

    const cropIcon = document.createElement("img");
    cropIcon.alt = "";
    cropIcon.draggable = false;
    cropIcon.decoding = "async";
    Object.assign(cropIcon.style, {
      flex: "0 0 18px",
      width: "18px",
      height: "18px",
      margin: "0",
      padding: "0",
      objectFit: "contain",
      borderRadius: "4px",
    });
    setCompactSpacing(cropIcon);

    const cropFallback = document.createElement("span");
    cropFallback.setAttribute("aria-hidden", "true");
    Object.assign(cropFallback.style, {
      display: "none",
      flex: "0 0 18px",
      width: "18px",
      textAlign: "center",
      fontSize: "14px",
      lineHeight: "18px",
    });

    const select = document.createElement("select");
    select.setAttribute("aria-label", ariaLabel);
    Object.assign(select.style, {
      boxSizing: "border-box",
      width: "100%",
      minWidth: "0",
      height: "23px",
      margin: "0",
      padding: "1px 3px",
      border: "1px solid #d5e1d6",
      borderRadius: "6px",
      background: "#fff",
      color: "#263c2d",
      font: "10.5px system-ui, sans-serif",
    });
    setCompactSpacing(select, "1px 3px");

    for (const optionLabel of options) {
      const option = document.createElement("option");
      option.value = optionLabel;
      option.textContent = optionLabel;
      select.append(option);
    }
    select.value = selectedValue;
    function updateCropIcon(value) {
      const [asset, fallback] = CROP_ICONS[value] ?? ["", "🌱"];
      cropFallback.textContent = fallback;
      cropIcon.style.display = asset ? "block" : "none";
      cropFallback.style.display = asset ? "none" : "block";
      if (asset) cropIcon.src = `/img/farm/i-${asset}.webp`;
    }
    cropIcon.addEventListener("error", () => {
      cropIcon.style.display = "none";
      cropFallback.style.display = "block";
    });
    updateCropIcon(selectedValue);
    select.addEventListener("change", () => {
      updateCropIcon(select.value);
      onChange(select.value);
    });
    optionControl.append(cropIcon, cropFallback, select);
    row.append(optionControl);
    targetContainer.append(row);
    return select;
  }

  function createSimpleSelect(
    labelText,
    ariaLabel,
    options,
    selectedValue,
    onChange,
    targetContainer,
  ) {
    const row = document.createElement("label");
    Object.assign(row.style, {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "2px",
      minWidth: "0",
      alignContent: "start",
      margin: "0",
      padding: "0",
      color: "#425849",
      fontSize: "11px",
      cursor: "pointer",
    });
    setCompactSpacing(row);

    const label = document.createElement("span");
    label.textContent = labelText;
    label.title = labelText;
    Object.assign(label.style, {
      minWidth: "0",
      overflow: "hidden",
      fontSize: "9px",
      fontWeight: "600",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    });
    row.append(label);

    const select = document.createElement("select");
    select.setAttribute("aria-label", ariaLabel);
    Object.assign(select.style, {
      boxSizing: "border-box",
      width: "100%",
      minWidth: "0",
      height: "22px",
      margin: "0",
      padding: "1px 3px",
      border: "1px solid #d5e1d6",
      borderRadius: "6px",
      background: "#fff",
      color: "#263c2d",
      font: "9.5px system-ui, sans-serif",
    });
    setCompactSpacing(select, "1px 3px");
    for (const optionLabel of options) {
      const option = document.createElement("option");
      option.value = optionLabel;
      option.textContent = optionLabel;
      select.append(option);
    }
    select.value = selectedValue;
    select.addEventListener("change", () => onChange(select.value));
    row.append(select);
    targetContainer.append(row);
    return select;
  }

  function createFeatureList() {
    const featureList = document.createElement("div");
    Object.assign(featureList.style, {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "3px 6px",
      margin: "0",
      padding: "0",
    });
    setCompactSpacing(featureList);
    return featureList;
  }

  function appendFeatureToggle(feature, featureList) {
    const featureLabel = document.createElement("label");
    Object.assign(featureLabel.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "3px",
      minHeight: "21px",
      margin: "0",
      padding: "0",
      color: "#425849",
      fontSize: "11px",
      cursor: "pointer",
    });
    setCompactSpacing(featureLabel);
    featureLabel.append(document.createTextNode(feature.label));

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = isFeatureEnabled(feature.key);
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", `Tự động ${feature.label}`);
    const toggleTrack = document.createElement("span");
    Object.assign(toggle.style, {
      position: "absolute",
      inset: "0",
      width: "30px",
      height: "18px",
      margin: "0",
      opacity: "0",
      cursor: "pointer",
    });
    setCompactSpacing(toggle);
    Object.assign(toggleTrack.style, {
      position: "relative",
      display: "block",
      flex: "0 0 30px",
      width: "30px",
      height: "18px",
      borderRadius: "999px",
      background: toggle.checked ? "#25834d" : "#c5cec7",
      transition: "background 120ms ease",
    });
    const toggleKnob = document.createElement("span");
    Object.assign(toggleKnob.style, {
      position: "absolute",
      top: "2px",
      left: toggle.checked ? "14px" : "2px",
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 1px 3px #0003",
      transition: "left 120ms ease",
      pointerEvents: "none",
    });
    toggleTrack.append(toggle, toggleKnob);
    toggle.addEventListener("change", () => {
      if (
        feature.key === "villagers" &&
        toggle.checked &&
        !window.confirm(
          "Bật tự động Dân Làng? Có thể dùng nguyên liệu quý hiếm, ảnh hưởng tu luyện.",
        )
      ) {
        toggle.checked = false;
        toggleTrack.style.background = "#c5cec7";
        toggleKnob.style.left = "2px";
        return;
      }

      enabledFeatures[feature.key] = toggle.checked;
      toggleTrack.style.background = toggle.checked ? "#25834d" : "#c5cec7";
      toggleKnob.style.left = toggle.checked ? "14px" : "2px";
      storeOption(
        `${FEATURE_TOGGLE_STORAGE_PREFIX}${feature.key}`,
        String(toggle.checked),
      );
      console.info(
        `[AT-SP] Tự động ${feature.label}: ${toggle.checked ? "bật" : "tắt"}.`,
      );
      if (feature.onChange) feature.onChange(toggle.checked);
      if (feature.key === "games" && toggle.checked) {
        nextGameCheckAfter = 0;
      }
    });
    featureLabel.append(toggleTrack);
    featureList.append(featureLabel);
  }

  function setWorkshopCardHidden(card, hidden) {
    if (hidden) {
      if (!hiddenWorkshopCardStyles.has(card)) {
        hiddenWorkshopCardStyles.set(
          card,
          Object.fromEntries(
            WORKSHOP_HIDDEN_STYLE_PROPERTIES.map((property) => [
              property,
              {
                value: card.style.getPropertyValue(property),
                priority: card.style.getPropertyPriority(property),
              },
            ]),
          ),
        );
      }

      card.style.setProperty("position", "absolute", "important");
      card.style.setProperty("left", "-10000px", "important");
      card.style.setProperty("top", "0", "important");
      card.style.setProperty("pointer-events", "none", "important");
      return;
    }

    const savedStyles = hiddenWorkshopCardStyles.get(card);
    if (!savedStyles) return;

    for (const property of WORKSHOP_HIDDEN_STYLE_PROPERTIES) {
      const { value, priority } = savedStyles[property];
      if (value) {
        card.style.setProperty(property, value, priority);
      } else {
        card.style.removeProperty(property);
      }
    }
    hiddenWorkshopCardStyles.delete(card);
  }

  function updateWorkshopCardVisibility(pageDocument) {
    for (const card of pageDocument.querySelectorAll(
      ".fm-grid.machines .fm-machine",
    )) {
      const machineName =
        card.querySelector(".fm-machine-top .fm-rn")?.textContent.trim() ?? "";
      const machine = WORKSHOP_MACHINE_OPTIONS.find(
        (option) =>
          option.label.toLocaleLowerCase() === machineName.toLocaleLowerCase(),
      );

      if (!machine) {
        setWorkshopCardHidden(card, false);
        continue;
      }

      setWorkshopCardHidden(
        card,
        !isFeatureEnabled(`${WORKSHOP_MACHINE_TOGGLE_PREFIX}${machine.key}`),
      );
    }
  }

  function containsWorkshopGridChange(mutations) {
    return mutations.some((mutation) => {
      const target =
        mutation.target.nodeType === Node.ELEMENT_NODE
          ? mutation.target
          : mutation.target.parentElement;
      if (target?.closest(".fm-machine-top")) return true;

      return Array.from(mutation.addedNodes).some(
        (node) =>
          node.nodeType === Node.ELEMENT_NODE &&
          (node.matches(".fm-grid.machines, .fm-machine") ||
            node.querySelector(".fm-grid.machines .fm-machine")),
      );
    });
  }

  for (const [groupIndex, group] of AUTOMATION_FEATURE_GROUPS.entries()) {
    const groupPanel = document.createElement("div");
    groupPanel.setAttribute("role", "tabpanel");
    groupPanel.id = `at-sp-settings-area-${groupIndex + 1}`;
    groupPanel.hidden = true;
    Object.assign(groupPanel.style, {
      display: "none",
      gap: "4px",
      margin: "0",
      padding: "5px",
      border: "1px solid #e3ebe2",
      borderRadius: "10px",
      background: "#fff",
    });
    setCompactSpacing(groupPanel, "5px");

    if (group.name === "Ruộng") groupPanel.append(plantingControl);

    const groupHeading = document.createElement("strong");
    groupHeading.textContent = `${group.icon} ${group.name} · Tự động`;
    Object.assign(groupHeading.style, {
      margin: "0",
      paddingBottom: "3px",
      borderBottom: "1px solid #edf1ed",
      color: "#304837",
      fontSize: "11px",
    });
    setCompactSpacing(groupHeading, "0 0 3px");
    groupPanel.append(groupHeading);

    if (group.name === "Chuồng") {
      const ranchTabs = document.createElement("div");
      ranchTabs.setAttribute("role", "tablist");
      ranchTabs.setAttribute("aria-label", "Cài đặt Chuồng");
      Object.assign(ranchTabs.style, {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "3px",
        margin: "0",
        padding: "2px",
        borderRadius: "9px",
        background: "#eaf1ea",
      });
      setCompactSpacing(ranchTabs, "2px");

      const ranchPanels = document.createElement("div");
      Object.assign(ranchPanels.style, {
        margin: "0",
        padding: "0",
      });
      setCompactSpacing(ranchPanels);

      const ranchSections = [
        {
          label: "Chung",
          featureKeys: ["ranch", "silkworm", "compost"],
        },
        { label: "Ao", featureKeys: ["pond"], control: pondControl },
        {
          label: "Xưởng",
          featureKeys: ["workshop"],
          control: workshopControl,
        },
        {
          label: "Thần thú",
          featureKeys: ["mythical"],
          control: mythicalControl,
        },
      ];
      const ranchTabEntries = [];

      for (const [sectionIndex, section] of ranchSections.entries()) {
        const selected = sectionIndex === 0;
        const tab = document.createElement("button");
        tab.type = "button";
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", String(selected));
        tab.textContent = section.label;
        Object.assign(tab.style, {
          minWidth: "0",
          margin: "0",
          padding: "5px 2px",
          border: "0",
          borderRadius: "7px",
          color: selected ? "#fff" : "#53675a",
          background: selected ? "#25834d" : "transparent",
          font: "700 9.5px system-ui, sans-serif",
          whiteSpace: "nowrap",
          cursor: "pointer",
        });
        setCompactSpacing(tab, "5px 2px");

        const panel = document.createElement("div");
        panel.setAttribute("role", "tabpanel");
        panel.id = `at-sp-settings-ranch-${sectionIndex + 1}`;
        panel.hidden = !selected;
        Object.assign(panel.style, {
          display: selected ? "grid" : "none",
          gap: "4px",
          margin: "4px 0 0",
          padding: "4px",
          border: "1px solid #e3ebe2",
          borderRadius: "8px",
          background: "#fff",
        });
        setCompactSpacing(panel, "4px");
        tab.setAttribute("aria-controls", panel.id);

        const featureList = createFeatureList();
        for (const feature of group.features.filter((item) =>
          section.featureKeys.includes(item.key),
        )) {
          appendFeatureToggle(feature, featureList);
        }
        panel.append(featureList);
        if (section.control) panel.append(section.control);

        ranchTabs.append(tab);
        ranchPanels.append(panel);
        ranchTabEntries.push({ tab, panel });
      }

      ranchTabs.addEventListener("click", (event) => {
        const clickedTab = event.target.closest("button[role='tab']");
        const selectedEntry = ranchTabEntries.find(
          (entry) => entry.tab === clickedTab,
        );
        if (!selectedEntry) return;

        for (const entry of ranchTabEntries) {
          const active = entry === selectedEntry;
          entry.tab.setAttribute("aria-selected", String(active));
          entry.tab.style.color = active ? "#fff" : "#53675a";
          entry.tab.style.background = active ? "#25834d" : "transparent";
          entry.panel.hidden = !active;
          entry.panel.style.display = active ? "grid" : "none";
        }
      });

      groupPanel.append(ranchTabs, ranchPanels);
    } else {
      const featureList = createFeatureList();
      if (group.name === "Hàng xóm") {
        const scheduleControlList = createFeatureList();
        scheduleControlList.style.gridTemplateColumns = "minmax(0, 1fr)";
        const neighborScheduleNote = document.createElement("small");
        const updateScheduleNote = (enabled) => {
          neighborScheduleNote.textContent = enabled
            ? "Đang bật: các chức năng được bật chỉ chạy 05:00–08:30 và 17:30–01:00; nghỉ 01:00–05:00 và 08:30–17:30 (giờ Việt Nam)."
            : "Đang tắt giới hạn giờ: các chức năng được bật có thể chạy cả ngày.";
        };
        updateScheduleNote(isFeatureEnabled(AUTOMATION_SCHEDULE_TOGGLE_KEY));
        Object.assign(neighborScheduleNote.style, {
          display: "block",
          color: "#66776b",
          fontSize: "10px",
          lineHeight: "1.3",
        });
        setCompactSpacing(neighborScheduleNote, "3px 0 0");
        appendFeatureToggle(
          {
            key: AUTOMATION_SCHEDULE_TOGGLE_KEY,
            label: "Giới hạn giờ tự động",
            onChange: updateScheduleNote,
          },
          scheduleControlList,
        );
        for (const feature of group.features) {
          appendFeatureToggle(feature, featureList);
        }
        groupPanel.append(scheduleControlList, neighborScheduleNote, featureList);
      } else {
        for (const feature of group.features) {
          appendFeatureToggle(feature, featureList);
        }
        groupPanel.append(featureList);
      }
    }

    if (group.name === "Làng") {
      const explorationPlaces = [
        {
          label: "Ưu tiên 1",
          storageKey: EXPLORATION_PLACE_STORAGE_KEY,
          get value() {
            return selectedExplorationPlace;
          },
          set value(place) {
            selectedExplorationPlace = place;
          },
        },
        {
          label: "Ưu tiên 2",
          storageKey: EXPLORATION_PLACE_SECOND_STORAGE_KEY,
          get value() {
            return selectedExplorationPlaceSecond;
          },
          set value(place) {
            selectedExplorationPlaceSecond = place;
          },
        },
        {
          label: "Ưu tiên 3",
          storageKey: EXPLORATION_PLACE_THIRD_STORAGE_KEY,
          get value() {
            return selectedExplorationPlaceThird;
          },
          set value(place) {
            selectedExplorationPlaceThird = place;
          },
        },
      ];
      const explorationContainer = document.createElement("div");
      Object.assign(explorationContainer.style, {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "4px",
        margin: "4px 0 0",
        padding: "0",
      });
      setCompactSpacing(explorationContainer);

      for (const placePreference of explorationPlaces) {
        const explorationPlaceControl = document.createElement("label");
        explorationPlaceControl.textContent = placePreference.label;
        Object.assign(explorationPlaceControl.style, {
          display: "grid",
          gap: "2px",
          minWidth: "0",
          margin: "0",
          color: "#425849",
          font: "700 10px system-ui, sans-serif",
        });
        setCompactSpacing(explorationPlaceControl);

        const explorationPlaceSelect = document.createElement("select");
        explorationPlaceSelect.setAttribute(
          "aria-label",
          `Địa điểm khám phá ${placePreference.label}`,
        );
        Object.assign(explorationPlaceSelect.style, {
          boxSizing: "border-box",
          width: "100%",
          minWidth: "0",
          height: "24px",
          margin: "0",
          padding: "2px 3px",
          border: "1px solid #d5e1d6",
          borderRadius: "6px",
          background: "#fff",
          color: "#263c2d",
          font: "10.5px system-ui, sans-serif",
        });
        setCompactSpacing(explorationPlaceSelect, "2px 3px");
        for (const place of EXPLORATION_PLACE_OPTIONS) {
          const option = document.createElement("option");
          option.value = place;
          option.textContent = place;
          explorationPlaceSelect.append(option);
        }
        explorationPlaceSelect.value = placePreference.value;
        explorationPlaceSelect.addEventListener("change", () => {
          placePreference.value = explorationPlaceSelect.value;
          storeOption(placePreference.storageKey, placePreference.value);
          console.info(
            `[AT-SP] Địa điểm khám phá ${placePreference.label}: ${placePreference.value}.`,
          );
        });
        explorationPlaceControl.append(explorationPlaceSelect);
        explorationContainer.append(explorationPlaceControl);
      }
      groupPanel.append(explorationContainer);

      const gameKeyControl = document.createElement("label");
      gameKeyControl.textContent = "Gemini API key (chỉ dùng cho Đố vui)";
      Object.assign(gameKeyControl.style, {
        display: "grid",
        gap: "4px",
        margin: "4px 0 0",
        color: "#425849",
        font: "600 11px system-ui, sans-serif",
      });
      setCompactSpacing(gameKeyControl);

      const keyRow = document.createElement("span");
      Object.assign(keyRow.style, {
        display: "flex",
        gap: "4px",
        margin: "0",
      });
      setCompactSpacing(keyRow);

      const gameKeyInput = document.createElement("input");
      gameKeyInput.type = "password";
      gameKeyInput.autocomplete = "off";
      gameKeyInput.placeholder = "Dán key mới tại đây";
      gameKeyInput.setAttribute("aria-label", "Gemini API key cho Đố vui");
      gameKeyInput.value = GM_getValue(GAME_GEMINI_KEY_STORAGE_KEY, "");
      Object.assign(gameKeyInput.style, {
        boxSizing: "border-box",
        width: "100%",
        minWidth: "0",
        height: "28px",
        margin: "0",
        padding: "4px 6px",
        border: "1px solid #d5e1d6",
        borderRadius: "7px",
        background: "#fff",
        color: "#263c2d",
        font: "11px system-ui, sans-serif",
      });
      setCompactSpacing(gameKeyInput, "4px 6px");

      const saveGameKeyButton = document.createElement("button");
      saveGameKeyButton.type = "button";
      saveGameKeyButton.textContent = "Lưu";
      Object.assign(saveGameKeyButton.style, {
        flex: "0 0 auto",
        margin: "0",
        padding: "4px 8px",
        border: "0",
        borderRadius: "7px",
        background: "#25834d",
        color: "#fff",
        font: "700 11px system-ui, sans-serif",
        cursor: "pointer",
      });
      setCompactSpacing(saveGameKeyButton, "4px 8px");
      saveGameKeyButton.addEventListener("click", () => {
        const apiKey = gameKeyInput.value.trim();
        if (!apiKey) {
          console.warn("[AT-SP] Chưa nhập Gemini API key; không lưu.");
          return;
        }
        GM_setValue(GAME_GEMINI_KEY_STORAGE_KEY, apiKey);
        gameKeyInput.value = "";
        console.info(
          "[AT-SP] Đã lưu Gemini API key trong kho riêng của userscript manager.",
        );
      });
      keyRow.append(gameKeyInput, saveGameKeyButton);

      const keyNote = document.createElement("small");
      keyNote.textContent =
        "Key không được ghi vào source. Đố vui gửi câu hỏi/đáp án tới Gemini; Ghép 3 và Lật bài không cần key.";
      Object.assign(keyNote.style, {
        color: "#65796b",
        font: "10px/1.35 system-ui, sans-serif",
      });
      setCompactSpacing(keyNote);
      gameKeyControl.append(keyRow, keyNote);
      groupPanel.append(gameKeyControl);
    }
    createSettingsTab(group.name, groupPanel);
    settingsPanels.append(groupPanel);
  }

  settingsTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("button[role='tab']");
    if (!tab) return;
    currentTabEntry = tabEntries.find((entry) => entry.tab === tab);
    if (!currentTabEntry) return;

    for (const entry of tabEntries) {
      const active = entry === currentTabEntry;
      entry.tab.setAttribute("aria-selected", String(active));
      entry.tab.style.color = active ? "#fff" : "#53675a";
      entry.tab.style.background = active ? "#25834d" : "transparent";
      entry.panel.hidden = !active;
      entry.panel.style.display = active
        ? entry === tabEntries[0]
          ? "block"
          : "grid"
        : "none";
    }
  });

  function readControlPosition() {
    try {
      const stored = window.localStorage.getItem(CONTROL_POSITION_STORAGE_KEY);
      if (!stored) return null;
      const position = JSON.parse(stored);
      if (
        !Number.isFinite(position?.left) ||
        !Number.isFinite(position?.top)
      ) {
        console.warn("[AT-SP] Tọa độ bảng điều khiển đã lưu không hợp lệ.");
        return null;
      }
      return position;
    } catch (error) {
      console.warn("[AT-SP] Không đọc được vị trí bảng điều khiển đã lưu.", error);
      return null;
    }
  }

  function saveControlPosition(left, top) {
    storeOption(CONTROL_POSITION_STORAGE_KEY, JSON.stringify({ left, top }));
  }

  function setImportantStyles(element, styles) {
    for (const [property, value] of Object.entries(styles)) {
      element.style.setProperty(property, value, "important");
    }
  }

  function applyPanelAppearance(expanded) {
    setImportantStyles(controlPanel, {
      position: "fixed",
      "z-index": "2147483647",
      display: "grid",
      "box-sizing": "border-box",
      width: expanded ? "min(270px, calc(100vw - 72px))" : "22px",
      height: expanded ? "auto" : "22px",
      "max-height": expanded ? "calc(100vh - 16px)" : "22px",
      gap: expanded ? "7px" : "0",
      padding: expanded ? "5px" : "0",
      border: expanded ? "1px solid #dce8dd" : "0",
      background: expanded
        ? "linear-gradient(145deg, #ffffff, #f3f8f2)"
        : "transparent",
      "box-shadow": expanded ? "0 10px 32px #183b2540" : "none",
      "border-radius": expanded ? "12px" : "0",
      "overflow-y": expanded ? "auto" : "visible",
    });
    setImportantStyles(panelHeader, {
      display: "flex",
      "box-sizing": "border-box",
      width: "100%",
      "min-height": expanded ? "28px" : "22px",
      height: expanded ? "28px" : "22px",
      gap: expanded ? "6px" : "0",
      "justify-content": expanded ? "initial" : "center",
      "border-bottom": expanded ? "1px solid #e4ece4" : "0",
    });
    setImportantStyles(panelContent, {
      display: expanded ? "grid" : "none",
    });
    setImportantStyles(dragIcon, {
      display: expanded ? "block" : "none",
    });
    setImportantStyles(panelHeading, {
      display: expanded ? "flex" : "none",
    });
    setImportantStyles(updateLink, {
      display: expanded ? "grid" : "none",
      "place-items": "center",
      flex: "0 0 22px",
      width: "22px",
      height: "22px",
      "min-width": "22px",
      "max-width": "22px",
      "box-sizing": "border-box",
      margin: "0",
      padding: "0",
      color: "#60816a",
      "text-decoration": "none",
      cursor: "pointer",
    });
    setImportantStyles(expandButton, {
      appearance: "none",
      "-webkit-appearance": "none",
      display: "grid",
      "place-items": "center",
      flex: expanded ? "0 0 27px" : "0 0 22px",
      width: expanded ? "27px" : "22px",
      height: expanded ? "27px" : "22px",
      "min-width": expanded ? "27px" : "22px",
      "max-width": expanded ? "27px" : "22px",
      "box-sizing": "border-box",
      margin: "0",
      padding: "0",
      border: "0",
      outline: "0",
      background: "transparent",
      "border-radius": "0",
      color: "#e5a900",
      "text-align": "center",
      "text-indent": "0",
      "text-transform": "none",
      "letter-spacing": "normal",
      "text-shadow": "none",
      "white-space": "nowrap",
      font: expanded
        ? "20px/1 system-ui, sans-serif"
        : "15px/1 system-ui, sans-serif",
      "line-height": "1",
      opacity: expanded ? "1" : "0.28",
      cursor: "pointer",
    });
  }

  function clampControlPosition(left, top) {
    const margin = 8;
    const bounds = controlPanel.getBoundingClientRect();
    return {
      left: Math.max(margin, Math.min(left, window.innerWidth - bounds.width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - bounds.height - margin)),
    };
  }

  const savedControlPosition = readControlPosition();
  if (savedControlPosition) {
    controlPanel.style.left = `${savedControlPosition.left}px`;
    controlPanel.style.top = `${savedControlPosition.top}px`;
    controlPanel.style.right = "auto";
    controlPanel.style.bottom = "auto";
  }

  let dragState = null;

  function startPanelDrag(event, element) {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const bounds = controlPanel.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    controlPanel.style.left = `${bounds.left}px`;
    controlPanel.style.top = `${bounds.top}px`;
    controlPanel.style.right = "auto";
    controlPanel.style.bottom = "auto";
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  panelHeader.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a")) return;
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const bounds = controlPanel.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    controlPanel.style.left = `${bounds.left}px`;
    controlPanel.style.top = `${bounds.top}px`;
    controlPanel.style.right = "auto";
    controlPanel.style.bottom = "auto";
    panelHeader.style.cursor = "grabbing";
    panelHeader.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  panelHeader.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) > 5) dragState.moved = true;
    if (!dragState.moved) return;
    const position = clampControlPosition(
      event.clientX - dragState.offsetX,
      event.clientY - dragState.offsetY,
    );
    controlPanel.style.left = `${position.left}px`;
    controlPanel.style.top = `${position.top}px`;
  });
  function finishPanelDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const wasMoved = dragState.moved;
    const bounds = controlPanel.getBoundingClientRect();
    const position = clampControlPosition(bounds.left, bounds.top);
    controlPanel.style.left = `${position.left}px`;
    controlPanel.style.top = `${position.top}px`;
    panelHeader.style.cursor = "grab";
    dragState = null;
    if (wasMoved) {
      saveControlPosition(position.left, position.top);
      event.stopImmediatePropagation();
    }
  }
  panelHeader.addEventListener("pointerup", finishPanelDrag);
  panelHeader.addEventListener("pointercancel", finishPanelDrag);
  window.addEventListener("resize", () => {
    if (!controlPanel.isConnected) return;
    const bounds = controlPanel.getBoundingClientRect();
    const position = clampControlPosition(bounds.left, bounds.top);
    controlPanel.style.left = `${position.left}px`;
    controlPanel.style.top = `${position.top}px`;
    controlPanel.style.right = "auto";
    controlPanel.style.bottom = "auto";
    saveControlPosition(position.left, position.top);
  });

  function setControlPanelExpanded(expanded) {
    expandButton.setAttribute("aria-expanded", String(expanded));
    expandButton.setAttribute(
      "aria-label",
      expanded ? "Thu gọn bảng điều khiển" : "Mở bảng điều khiển",
    );
    expandButton.title = expanded
      ? "Thu gọn bảng điều khiển"
      : "Mở bảng điều khiển";
    expandButton.textContent = "⭐";
    applyPanelAppearance(expanded);
  }
  expandButton.addEventListener("click", () => {
    setControlPanelExpanded(expandButton.getAttribute("aria-expanded") !== "true");
  });
  expandButton.addEventListener("mouseenter", () => {
    if (expandButton.getAttribute("aria-expanded") !== "true") {
      expandButton.style.setProperty("opacity", "0.85", "important");
    }
  });
  expandButton.addEventListener("mouseleave", () => {
    if (expandButton.getAttribute("aria-expanded") !== "true") {
      expandButton.style.setProperty("opacity", "0.28", "important");
    }
  });
  applyPanelAppearance(false);
  panelContent.append(settingsTabs, settingsPanels);
  controlPanel.append(panelHeader, panelContent);

  createCropSelect(
    "Ruộng:",
    "Cây trồng mặc định cho ruộng",
    FIELD_CROP_OPTIONS,
    selectedFieldCrop,
    (value) => {
      selectedFieldCrop = value;
      storeOption(FIELD_CROP_STORAGE_KEY, value);
      console.info(`[AT-SP] Cây trồng ruộng mặc định: ${value}.`);
    },
  );
  createCropSelect(
    "Hoa:",
    "Hoa mặc định",
    FLOWER_CROP_OPTIONS,
    selectedFlowerCrop,
    (value) => {
      selectedFlowerCrop = value;
      storeOption(FLOWER_CROP_STORAGE_KEY, value);
      console.info(`[AT-SP] Hoa mặc định: ${value}.`);
    },
  );
  createCropSelect(
    "Nấm:",
    "Loại nấm mặc định",
    MUSHROOM_CROP_OPTIONS,
    selectedMushroomCrop,
    (value) => {
      selectedMushroomCrop = value;
      storeOption(MUSHROOM_CROP_STORAGE_KEY, value);
      console.info(`[AT-SP] Nấm mặc định: ${value}.`);
    },
  );
  createCropSelect(
    "Thuốc:",
    "Loại cây thuốc mặc định",
    MEDICINE_CROP_OPTIONS,
    selectedMedicineCrop,
    (value) => {
      selectedMedicineCrop = value;
      storeOption(MEDICINE_CROP_STORAGE_KEY, value);
      console.info(`[AT-SP] Cây thuốc mặc định: ${value}.`);
    },
  );
  createCropSelect(
    "Rừng:",
    "Loại rừng trồng mặc định",
    FOREST_CROP_OPTIONS,
    selectedForestCrop,
    (value) => {
      selectedForestCrop = value;
      storeOption(FOREST_CROP_STORAGE_KEY, value);
      console.info(`[AT-SP] Loại rừng trồng mặc định: ${value}.`);
    },
  );
  createCropSelect(
    "Ao:",
    "Giống thả ao mặc định",
    [...POND_FISH_OPTIONS, NO_SELECTION_OPTION],
    selectedPondFish,
    (value) => {
      selectedPondFish = value;
      storeOption(POND_FISH_STORAGE_KEY, value);
      console.info(`[AT-SP] Giống thả ao mặc định: ${value}.`);
    },
    pondControl,
  );
  const workshopToggleList = createFeatureList();
  workshopToggleList.style.gridColumn = "1 / -1";
  for (const machine of WORKSHOP_MACHINE_OPTIONS) {
    appendFeatureToggle(
      {
        key: `${WORKSHOP_MACHINE_TOGGLE_PREFIX}${machine.key}`,
        label: machine.label,
        onChange: () => {
          for (const pageDocument of getPageDocuments()) {
            updateWorkshopCardVisibility(pageDocument);
          }
        },
      },
      workshopToggleList,
    );
  }
  workshopControl.append(workshopToggleList);

  const workshopNote = document.createElement("small");
  workshopNote.textContent =
    "Bật: ưu tiên món tồn ít nhất; hòa thì chọn ngẫu nhiên. Lò thuốc ưu tiên Trà thảo dược.";
  Object.assign(workshopNote.style, {
    gridColumn: "1 / -1",
    color: "#627267",
    fontSize: "9px",
    lineHeight: "1.3",
  });
  workshopControl.append(workshopNote);

  const forgeOptions = WORKSHOP_MACHINE_OPTIONS.find(
    (machine) => machine.key === "forge",
  );
  if (forgeOptions) {
    createSimpleSelect(
      "Xưởng Rèn:",
      "Sản phẩm tự động cho Xưởng Rèn",
      [...forgeOptions.products, RANDOM_SELECTION_OPTION],
      selectedForgeRecipe,
      (value) => {
        selectedForgeRecipe = value;
        storeOption(`${WORKSHOP_RECIPE_STORAGE_PREFIX}forge`, value);
        console.info(`[AT-SP] Sản phẩm tự động Xưởng Rèn: ${value}.`);
      },
      workshopControl,
    );
  }
  createSimpleSelect(
    "Loại thú:",
    "Thú huyền thoại mặc định",
    [...MYTHICAL_BEAST_OPTIONS, NO_SELECTION_OPTION],
    selectedMythicalBeast,
    (value) => {
      selectedMythicalBeast = value;
      storeOption(MYTHICAL_BEAST_STORAGE_KEY, value);
      console.info(`[AT-SP] Thú huyền thoại mặc định: ${value}.`);
    },
    mythicalControl,
  );

  function updateControl() {
    control.textContent = isRunning ? "⏸ Dừng tự động" : "▶ Bật tự động";
    control.setAttribute("aria-pressed", String(isRunning));
    control.style.background = isRunning ? "#b42318" : "#157347";
    control.title = isRunning
      ? `Đang kiểm tra Hàng xóm trước, rồi thông báo mỗi ${checkIntervalMs / 1000} giây; trò chơi chỉ chạy khi bật; Quán ăn và Chuồng mỗi 60 giây; bấm để dừng`
      : "Đang dừng; bấm để bắt đầu tự động";
  }

  function scheduleRanchChecks(generation) {
    ranchStartTimeoutId = window.setTimeout(() => {
      ranchStartTimeoutId = null;
      if (!shouldContinue(generation)) return;

      void checkRanchActions(generation);
      ranchIntervalId = window.setInterval(
        () => void checkRanchActions(generation),
        RANCH_CHECK_INTERVAL_MS,
      );
    }, RANCH_INITIAL_DELAY_MS);
  }

  function restartInterval() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    if (restaurantIntervalId !== null) {
      window.clearInterval(restaurantIntervalId);
      restaurantIntervalId = null;
    }
    if (ranchIntervalId !== null) {
      window.clearInterval(ranchIntervalId);
      ranchIntervalId = null;
    }
    if (ranchStartTimeoutId !== null) {
      window.clearTimeout(ranchStartTimeoutId);
      ranchStartTimeoutId = null;
    }

    if (isRunning) {
      const generation = runGeneration;
      intervalId = window.setInterval(
        () => void runPriorityCycle(generation),
        checkIntervalMs,
      );
      void runPriorityCycle(generation);
      restaurantIntervalId = window.setInterval(
        () => void checkRestaurantService(generation),
        RESTAURANT_CHECK_INTERVAL_MS,
      );
      scheduleRanchChecks(generation);
    }
  }

  intervalSelect.addEventListener("change", () => {
    const selectedSeconds = Number(intervalSelect.value);
    if (![0.5, 1, 2, 5].includes(selectedSeconds)) return;

    checkIntervalMs = selectedSeconds * 1_000;
    restartInterval();
    updateControl();
    console.info(
      `[AT-SP] Chu kỳ ưu tiên kiểm tra Hàng xóm rồi thông báo: ${selectedSeconds} giây.`,
    );
  });

  control.addEventListener("click", () => {
    if (isRunning) {
      isRunning = false;
      runGeneration += 1;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      if (restaurantIntervalId !== null) {
        window.clearInterval(restaurantIntervalId);
        restaurantIntervalId = null;
      }
      if (ranchIntervalId !== null) {
        window.clearInterval(ranchIntervalId);
        ranchIntervalId = null;
      }
      if (ranchStartTimeoutId !== null) {
        window.clearTimeout(ranchStartTimeoutId);
        ranchStartTimeoutId = null;
      }
      updateControl();
      console.info("[AT-SP] Đã dừng tự động.");
      return;
    }

    isRunning = true;
    runGeneration += 1;
    const generation = runGeneration;
    updateControl();
    console.info(
      `[AT-SP] Đã bật tự động; kiểm tra Hàng xóm trước, rồi thông báo mỗi ${checkIntervalMs / 1000} giây; trò chơi ${isFeatureEnabled("games") ? "đang bật" : "đang tắt"}.`,
    );
    intervalId = window.setInterval(
      () => void runPriorityCycle(generation),
      checkIntervalMs,
    );
    void runPriorityCycle(generation);
    restaurantIntervalId = window.setInterval(
      () => void checkRestaurantService(generation),
      RESTAURANT_CHECK_INTERVAL_MS,
    );
    scheduleRanchChecks(generation);
  });

  updateControl();
  document.body.append(controlPanel);
  if (savedControlPosition) {
    const bounds = controlPanel.getBoundingClientRect();
    const position = clampControlPosition(bounds.left, bounds.top);
    controlPanel.style.left = `${position.left}px`;
    controlPanel.style.top = `${position.top}px`;
    saveControlPosition(position.left, position.top);
  }

  for (const pageDocument of getPageDocuments()) {
    const MutationObserverConstructor =
      pageDocument.defaultView?.MutationObserver;
    if (!pageDocument.body || !MutationObserverConstructor) continue;

    updateWorkshopCardVisibility(pageDocument);
    const toastObserver = new MutationObserverConstructor((mutations) => {
      if (containsWorkshopGridChange(mutations)) {
        updateWorkshopCardVisibility(pageDocument);
      }
      if (isRunning) stopForInsufficientResources();
    });
    toastObserver.observe(pageDocument.body, {
      attributes: true,
      attributeFilter: ["class", "hidden", "style"],
      characterData: true,
      childList: true,
      subtree: true,
    });
  }
})();