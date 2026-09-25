/**
 * English text for the internal pages (services, pricing, how it works, regular
 * laundry, locations, about) and the components they share. Server-only in practice:
 * import it from Server Components, never from a Client Component (it would ship to
 * the browser). The Bangla file (bn.ts) must provide exactly the same keys.
 *
 * "{name}" placeholders are filled with fill(), which also switches digits for Bangla.
 */
export const pagesEn = {
  /** Shared service-page chrome (components/services). */
  service: {
    eyebrow: "{service} in Uttara",
    glance: "At a glance",
    glancePricing: "Pricing",
    glanceTurnaround: "Turnaround",
    glancePickup: "Pickup",
    glanceBestFor: "Best for",
    glancePickupValue: "{area}. Free on orders of {amount}+",
    dropOff: "Or drop off at Sector 11 or 18",
    customerProof: "Customer proof",
    reviewsAbout: "What customers say about {service}",
    reviewsGeneral: "What Velto customers say",
    reviewsLabel: "Customer reviews",
    reviewsLabelOf: "Customer reviews of {service}",
    quoteHelper: "Share the details. We’ll confirm the price with you before pickup.",
    blockEyebrows: {
      scope: "What you can send",
      prices: "Prices",
      process: "How it's handled",
      notes: "Good to know",
      compare: "Choosing a service",
      measure: "Measuring",
      facts: "What happens next",
      review: "Customer proof",
    },
    pricesCaption: "{service} prices",
    lookUpAnother: "Look up another item",
    pricesSource: "Prices from Velto's current price list.",
    seeEveryOrder: "See how every order is handled",
    workedExample: "Worked example",
  },
  priceTable: {
    item: "Item",
    notOffered: "Not offered",
    afterAssessment: "After assessment",
    afterAssessmentNote: "“After assessment” means the price is confirmed once Velto has seen the item.",
    errorTitle: "Prices couldn't load right now.",
    errorBody:
      "Search the full price list or ask Velto on WhatsApp. You can also book a pickup: we go through prices when we call to confirm.",
    searchList: "Search the price list",
    loading: "Loading prices",
  },
  compare: {
    caption: "Wash & Iron, Ironing and Dry Cleaning compared",
    thisPage: "This page",
    whatHappens: "What happens",
    usuallyTakes: "Usually takes",
    chooseFor: "Choose it for",
    oneShirt: "One shirt",
    shirt: "Shirt",
    options: {
      "wash-and-iron": { time: "Usually around 72 hours", forWhat: "Everyday clothes and linen that need washing." },
      ironing: { time: "General orders usually around 48 hours", forWhat: "Clothes already washed that just need pressing." },
      "dry-cleaning": { time: "Usually around 72 hours", forWhat: "Suits, saris, sherwanis and garments that need a closer look." },
    },
  },
  figures: {
    outletsSpoken: "{count} outlets",
    outletsLabel: "Outlets, in {names}",
    and: " and ",
    locationRatingLabel: "Google rating, {reviews} reviews for {name}",
  },
  /** How It Works: the ten-step operational sequence in four stages. */
  operational: {
    eyebrow: "After pickup",
    stage: "Stage {n} of 4",
    groups: [
      {
        label: "Collect and check in",
        steps: [
          { title: "Pickup", copy: "We collect the order from your address in Uttara." },
          { title: "Structured intake", copy: "The order is counted and connected to you." },
          { title: "Identification and tagging", copy: "Each item is tagged so it stays with your order from check-in to packing." },
        ],
      },
      {
        label: "Assess and route",
        steps: [
          { title: "Assessment", copy: "We look over the fabric, condition and visible stains before choosing the treatment." },
          { title: "Service routing", copy: "Each item goes to the treatment it was assessed for." },
        ],
      },
      {
        label: "Clean and finish",
        steps: [
          { title: "Cleaning", copy: "Each item is cleaned for the booked service." },
          { title: "Finishing", copy: "It is then pressed or finished where needed." },
        ],
      },
      {
        label: "Check and return",
        steps: [
          { title: "Quality check", copy: "Finished items are checked again before they are packed." },
          { title: "Packaging", copy: "Your finished order is organised and packed for delivery." },
          { title: "Delivery", copy: "Delivery is arranged back to your address." },
        ],
      },
    ],
  },
  servicesPage: {
    title: "Which service do you need?",
    highlight: "Which service",
    eyebrow: "Services",
    viewPricing: "View Pricing",
    intro:
      "Every service begins with a pickup from your door in Uttara Sectors 1–18. Not sure which one fits? Send a photo on WhatsApp and we'll tell you.",
    chooseEyebrow: "All services",
    chooseTitle: "Start with what you're sending.",
    groups: ["Clothes", "Curtains, carpets and bedding", "Timing"],
    compareTitle: "Wash & Iron, Ironing or Dry Cleaning?",
    compareIntro: "The three clothing services, side by side.",
    pricingEyebrow: "Pricing",
    pricingTitle: "How each service is priced",
    pricingIntro:
      "Free pickup & delivery on orders of {amount}+. Smaller orders have a pickup and delivery charge, which we tell you when we confirm.",
    models: [
      {
        title: "Clothes are priced per item",
        copy: "Every garment has its own price for each service it can have, so you can check before you send it. A few items are priced after assessment, once Velto has seen them.",
        label: "Search the price list",
      },
      {
        title: "Curtains and carpets are priced per square foot",
        copy: "Send the approximate size. Velto confirms the final amount when measurement or condition needs checking.",
        label: "Request a Quote",
      },
      {
        title: "Blankets, comforters and quilts are priced per piece",
        copy: "By type and size, so most bedding can be booked straight away.",
        label: "See bedding prices",
      },
    ],
    faqTitle: "Before you choose.",
    finalTitle: "Not sure which service?",
    finalBody:
      "Book a pickup and add a note, or send a photo on WhatsApp. We can help you choose before anything is cleaned.",
  },
  pricingPage: {
    eyebrow: "Pricing",
    titleBefore: "Find the ",
    titleHighlight: "price",
    titleAfter: " of an item.",
    intro:
      "Prices are set per item and service. Search for what you want to send to see the services available and the current Velto price.",
    asideLabel: "Delivery and turnaround",
    free: "Free pickup & delivery on orders of {amount}+.",
    smaller:
      "For smaller orders, a pickup and delivery charge applies. We tell you the amount when we confirm your pickup.",
    mayTakeLonger: "Some garments and household items may take longer.",
    knowTitle: "Know what you're sending?",
    knowBody: "Book the pickup now. We call or WhatsApp to confirm the time, and can go through prices then.",
    compareTitle: "Dry Cleaning, Wash & Iron or Ironing?",
    compareIntro:
      "Many items have a price for more than one service. This is what each one covers, so you can pick the right one.",
    householdEyebrow: "Household care",
    householdTitle: "Curtains, carpets and bedding are priced differently.",
    householdIntro: "These depend on size, material and condition, so they are not always a single item price.",
    household: [
      {
        label: "Curtains",
        copy: "Quantity and approximate size. We confirm the final amount when measurement or condition needs checking.",
        action: "Get a curtain quote",
      },
      {
        label: "Carpets",
        copy: "Approximate length and width. Material and condition can change the final price.",
        action: "Get a carpet quote",
      },
      { label: "Blankets & comforters", copy: "Mainly the item, type and size.", action: "Get a bedding quote" },
    ],
    seeAllServices: "See all services",
    faqTitle: "Pricing questions.",
    finalTitle: "Found what you need?",
    finalBody: "Book a pickup and we will collect from your door in Uttara Sectors 1–18.",
  },
  howPage: {
    title: "From your door and back again.",
    eyebrow: "How it works",
    highlight: "back again",
    intro:
      "You book, we collect. Everything in between follows the same steps for every order, so you know what happens to your clothes while they are with us.",
    yourSideEyebrow: "Your side",
    yourSideTitle: "Before and after we have it",
    yourSideIntro: "Pickup and delivery cover Uttara Sectors 1–18. Orders of {amount}+ qualify for free pickup and delivery.",
    steps: [
      { title: "Book", copy: "Book a pickup online or message Velto on WhatsApp. Tell us where to collect from and what you are sending." },
      { title: "Pickup", copy: "We collect the order from your address." },
      { title: "At Velto", copy: "Your order is checked in, tagged, cleaned, finished and checked again. Every step is below." },
      { title: "Return", copy: "Your finished order is packed and delivered back to your address." },
    ],
    processTitle: "What happens once your order reaches us",
    processIntro:
      "The same ten steps for every order, in four stages. Special garments and household items may add time where extra care is needed.",
  },
  regularPage: {
    reviewsSpecific: "From customers who keep coming back",
    title: "A regular laundry pickup, so the week takes care of itself.",
    eyebrow: "Regular laundry",
    highlight: "the week takes care of itself",
    asideBody: "Free pickup & delivery on a fixed weekly or fortnightly pickup. One-off orders qualify from {amount}+.",
    setUp: "Set Up Regular Pickup",
    intro:
      "Regular laundry and ironing can be arranged as recurring pickups, so you don't need to book from scratch every time. Agree a day once, put the clothes out, and they come back ready to wear.",
    howEyebrow: "The routine",
    howTitle: "How it works",
    howIntro: "The details of your schedule are agreed with you when you set it up.",
    steps: [
      { title: "Tell us what you usually send", copy: "Laundry, ironing or both, and roughly how much." },
      { title: "Agree a pickup routine", copy: "Tell us which day suits you. We confirm the schedule with you." },
      { title: "We collect and return", copy: "Each order is checked in, cleaned, finished, checked again and packed, like any other." },
    ],
    saveEyebrow: "Free pickup",
    saveTitle: "Put the week together.",
    saveIntro:
      "Laundry and ironing can go in the same pickup, so the week's clothes travel together and it's easier to reach {amount}+.",
    checkPrices: "Check item prices",
    finalTitle: "Set up your regular pickup.",
    finalBody: "Tell us where to collect from and which day suits you. We will confirm the routine with you.",
    finalHelper: "Send the request. We’ll agree the pickup day with you.",
  },
  locationsPage: {
    title: "Two outlets in Uttara. Pickup across Sectors 1–18.",
    eyebrow: "Locations",
    highlight: "Pickup across Sectors 1–18.",
    intro:
      "Velto serves Uttara Sectors 1–18, with locations in Sector 11 and Sector 18. Book a pickup from home or visit the outlet that works for you.",
    outletsTitle: "Our outlets",
    aboutOutlet: "About the {name} outlet",
    areaEyebrow: "Pickup",
    areaTitle: "Pickup and delivery across Uttara",
    areaIntro1:
      "We collect from your door and deliver back in every one of these Uttara sectors. You don't need to live near an outlet. Orders of {amount}+ are picked up and delivered free.",
    areaIntro2: "Outside Sectors 1–18? Ask us on WhatsApp before booking and we'll tell you what's possible.",
    sectorsTitle: "Sectors we collect from",
    sector: "Sector",
    outletsNote: "Outlets in Sector 11 (House 2, Road 14) and Sector 18 (RUAP, Poncoboti Bazar) for drop-off.",
  },
  locationPage: {
    title: "Laundry and dry cleaning in Uttara {name}",
    highlight: "Uttara {name}",
    eyebrow: "Velto {name}",
    open: "Open {hours}",
    noVisit: "You don't need to visit. Velto collects from your door anywhere in {area}, or you can drop off here.",
    visitEyebrow: "Visit or get a pickup",
    visitTitle: "Visiting the outlet",
    visitIntro: "Visit in person, or book a pickup from anywhere in Uttara Sectors 1–18.",
    address: "Address",
    hours: "Hours",
    pickup: "Pickup",
    pickupValue: "From your door anywhere in {area}. Free on orders of {amount}+.",
    googleRating: "Google rating",
    reviewsCount: "· {count} Google reviews",
    ratingSpoken: "{rating} out of 5 from {count} Google reviews for {name}",
    otherOutlet: "Velto {name}",
    servicesEyebrow: "Services",
    servicesTitle: "What you can send from {name}",
    servicesIntro:
      "Book a pickup for any of these from anywhere in Uttara Sectors 1–18, or visit the outlet. Check the price of an item before you send it.",
    checkPrices: "Check laundry and dry cleaning prices",
    finalTitle: "Rather not make the trip?",
    finalBody: "Book a pickup and we will collect from your door anywhere in Uttara Sectors 1–18.",
  },
  aboutPage: {
    crumb: "About",
    title: "A laundry in Uttara that works to a written process.",
    eyebrow: "About Velto",
    highlight: "a written process",
    intro:
      "Velto cleans clothes and household items for homes across Uttara, with pickup from your door and outlets in Sector 11 and Sector 18.",
    sopsEyebrow: "How we work",
    sopsTitle: "Written down, not left to memory.",
    sopsIntro: "The key steps of every order follow written operating procedures, so each order goes through the same checks.",
    sops: ["Garment intake", "Item and order identification", "Tagging", "Stain identification and handling", "Quality control"],
    seeHandled: "See how an order is handled",
    promiseEyebrow: "Honest limits",
    promiseTitle: "What we will and won't promise.",
    promise1:
      "We check garments and visible stains before cleaning. Some stains cannot be fully removed, and we would rather tell you that first than promise otherwise.",
    promise2:
      "Turnaround times are usual times, not guarantees. Special garments and household items can take longer, and we will say so when they do.",
  },
};

export type PageText = typeof pagesEn;
