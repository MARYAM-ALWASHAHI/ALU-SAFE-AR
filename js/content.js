// Training content. Everything a trainer may want to change lives here, so it can be
// reviewed by HSE and later loaded from a server instead of being hard-coded.
// `approved: false` keeps the "sample content" banner visible in the game.

export const CONTENT_META = {
  version: "0.1-sample",
  approved: false,
};

// Difficulty tuning.
export const DIFFICULTY = {
  easy:   { craneSpeed: 1.6, evacSeconds: 150, showArrow: true,  showDanger: true,  showMarkers: true },
  normal: { craneSpeed: 2.4, evacSeconds: 110, showArrow: true,  showDanger: false, showMarkers: true },
  hard:   { craneSpeed: 3.2, evacSeconds: 80,  showArrow: false, showDanger: false, showMarkers: false },
};

export const SCORING = { perMission: 100, secondTry: 50, laterTry: 20, violationPenalty: 25, minimum: 10 };

// PPE items for mission 1. `need: true` items are required in this scenario.
export const PPE_ITEMS = [
  { id: "helmet",   need: true,  en: "Hard hat", ar: "خوذة صلبة" },
  { id: "glasses",  need: true,  en: "Safety glasses", ar: "نظارة سلامة" },
  { id: "fr",       need: true,  en: "Flame-resistant (FR) clothing", ar: "ملابس مقاومة للهب" },
  { id: "boots",    need: true,  en: "Safety boots", ar: "حذاء سلامة" },
  { id: "gloves",   need: true,  en: "Heat-resistant gloves", ar: "قفازات مقاومة للحرارة" },
  { id: "ears",     need: true,  en: "Hearing protection", ar: "واقي سمع" },
  { id: "fleece",   need: false, en: "Synthetic fleece jacket", ar: "سترة من قماش صناعي",
    why: { en: "Synthetic fabric can melt onto skin near heat or molten metal.", ar: "القماش الصناعي قد يذوب ويلتصق بالجلد قرب الحرارة أو المعدن المنصهر." } },
  { id: "trainers", need: false, en: "Sports trainers", ar: "حذاء رياضي",
    why: { en: "Trainers give no protection from heavy objects, heat or sharp edges.", ar: "الحذاء الرياضي لا يحمي من الأجسام الثقيلة أو الحرارة أو الحواف الحادة." } },
];

// Missions run in this order. Positions are metres in the 3D hall (x along the hall, z across it).
export const MISSIONS = [
  {
    id: "ppe", type: "ppe",
    at: { x: -35.5, z: 11.2, r: 2.6 },
    name: { en: "PPE check", ar: "فحص معدات الوقاية" },
    objective: { en: "Go to the PPE station and gear up", ar: "اذهب إلى محطة معدات الوقاية وجهّز نفسك" },
    learn: { en: "Check you have the full PPE set for the area before you enter, and that every item is suitable.", ar: "تأكد قبل الدخول أن لديك كل معدات الوقاية المطلوبة للمنطقة، وأن كل قطعة مناسبة." },
  },
  {
    id: "house", type: "choice",
    at: { x: -22, z: 9, r: 2.8 },
    name: { en: "Blocked walkway", ar: "ممر مشاة مسدود" },
    objective: { en: "Follow the walkway and check the obstruction ahead", ar: "اتبع ممر المشاة وافحص العائق أمامك" },
    q: { en: "A hose and loose cables are lying across the pedestrian walkway.", ar: "خرطوم وأسلاك سائبة ممدودة عبر ممر المشاة." },
    opts: [
      { ok: true, fx: "good",
        t: { en: "Warn people nearby and report it so it is cleared or rerouted safely", ar: "أنبّه من حولي وأبلغ عنه ليُزال أو يُعاد توجيهه بأمان" },
        r: { en: "The hose was rerouted and the walkway is clear again.", ar: "أُعيد توجيه الخرطوم وأصبح الممر خالياً من جديد." } },
      { fx: "trip",
        t: { en: "Step over it and carry on", ar: "أتخطّاه وأكمل طريقي" },
        r: { en: "Your foot caught the hose and you stumbled. Trip hazards on walkways are a common cause of injury.", ar: "علقت قدمك بالخرطوم وتعثّرت. عوائق الممرات من أكثر أسباب الإصابات شيوعاً." } },
      { fx: "trip",
        t: { en: "Leave it, someone else will deal with it", ar: "أتركه، سيتعامل معه غيري" },
        r: { en: "A colleague carrying equipment did not see it and tripped. Safety is everyone’s responsibility.", ar: "زميل يحمل معدات لم يره فتعثّر به. السلامة مسؤولية الجميع." } },
    ],
    learn: { en: "Walkways must stay clear. Report trip hazards, and only move loose items when it is safe to do so.", ar: "ممرات المشاة يجب أن تبقى خالية. أبلغ عن عوائق التعثّر، ولا تحرّك إلا الأشياء السائبة وعندما يكون ذلك آمناً." },
  },
  {
    id: "crane", type: "reach",
    at: { x: -9, z: 6.4, r: 2.6 },
    target: { x: -6, z: -5.6, r: 1.8 },
    name: { en: "Overhead crane", ar: "الرافعة العلوية" },
    objective: { en: "Cross the crane aisle to the tapping bay", ar: "اعبر ممر الرافعة إلى منطقة السحب" },
    brief: { en: "An overhead crane is moving a heavy load along the aisle. Never walk under a suspended load. Wait until it has passed, then cross.", ar: "رافعة علوية تنقل حملاً ثقيلاً على طول الممر. لا تمشِ أبداً تحت حمل معلّق. انتظر حتى يمر ثم اعبر." },
    learn: { en: "Never stand or walk under a suspended load. Keep clear of the crane’s path and wait for it to pass.", ar: "لا تقف ولا تمشِ تحت حمل معلّق. ابتعد عن مسار الرافعة وانتظر حتى تمر." },
  },
  {
    id: "molten", type: "choice",
    at: { x: -3.4, z: -5.4, r: 2.8 },
    name: { en: "Molten metal and water", ar: "المعدن المنصهر والماء" },
    objective: { en: "Inspect the tapping bay before the crucible moves", ar: "افحص منطقة السحب قبل تحريك البوتقة" },
    q: { en: "A crucible of molten metal is about to move, and a hose is leaking water onto the floor of the bay.", ar: "بوتقة فيها معدن منصهر على وشك التحرك، وخرطوم يسرّب الماء على أرضية المنطقة." },
    opts: [
      { fx: "steam",
        t: { en: "Mop it up quickly while the crucible moves in", ar: "أمسحه بسرعة بينما تتحرك البوتقة" },
        r: { en: "The crucible arrived while the floor was still wet. Water trapped under molten metal can turn to steam instantly and throw metal out.", ar: "وصلت البوتقة والأرض ما زالت مبللة. الماء المحبوس تحت المعدن المنصهر قد يتحول إلى بخار فوراً ويقذف المعدن." } },
      { ok: true, fx: "good",
        t: { en: "Keep clear, warn the crew to hold the move, and report the leak so the area is made dry", ar: "أبتعد، وأنبّه الطاقم لإيقاف النقل، وأبلغ عن التسرّب حتى تُجفَّف المنطقة" },
        r: { en: "The move was held until the bay was dry and the leak fixed.", ar: "أوقِف النقل حتى جفّت المنطقة وأُصلح التسرّب." } },
      { fx: "steam",
        t: { en: "Ignore it, it is only a little water", ar: "أتجاهله، إنه ماء قليل فقط" },
        r: { en: "Even a small amount of water can cause a violent steam reaction with molten metal.", ar: "حتى كمية صغيرة من الماء قد تسبب تفاعلاً بخارياً عنيفاً مع المعدن المنصهر." } },
    ],
    learn: { en: "Keep molten-metal areas dry. If you see water, moisture or damp tools, stop, warn and report.", ar: "أبقِ مناطق المعدن المنصهر جافة. إذا رأيت ماءً أو رطوبة أو أدوات مبللة: توقّف، نبّه، وأبلغ." },
  },
  {
    id: "restricted", type: "reach",
    at: { x: -3.4, z: -5.4, r: 3.4 },
    target: { x: 28.6, z: -9.5, r: 1.8 },
    name: { en: "Restricted area", ar: "المنطقة المحظورة" },
    objective: { en: "Take the work permit to the control room", ar: "خذ تصريح العمل إلى غرفة التحكم" },
    brief: { en: "The area in front of the cells is marked restricted: authorised personnel only. The control room is beyond it. Find the safe route.", ar: "المنطقة أمام الخلايا محظورة إلا على المخوّلين. غرفة التحكم بعدها. ابحث عن الطريق الآمن." },
    learn: { en: "Respect barriers and restricted-area signs. Take the designated route even if it is longer.", ar: "احترم الحواجز ولافتات المناطق المحظورة. اسلك الطريق المخصص حتى لو كان أطول." },
  },
  {
    id: "evac", type: "evac",
    at: { x: 28.6, z: -9.5, r: 2.6 },
    target: { x: -45, z: -9.5, r: 3.2 },
    name: { en: "Emergency evacuation", ar: "إخلاء الطوارئ" },
    objective: { en: "Respond to the alarm", ar: "استجب لجرس الإنذار" },
    q: { en: "The alarm is sounding and there is smoke and fire at a vehicle in the aisle.", ar: "جرس الإنذار يرن، وهناك دخان ونار في مركبة داخل الممر." },
    opts: [
      { fx: "smoke",
        t: { en: "Go closer to see what is burning", ar: "أقترب لأرى ما الذي يحترق" },
        r: { en: "Smoke can overcome you quickly. Never approach a fire to look.", ar: "الدخان قد يفقدك وعيك بسرعة. لا تقترب من حريق لتنظر." } },
      { fx: "smoke",
        t: { en: "Try to put it out myself", ar: "أحاول إطفاءه بنفسي" },
        r: { en: "Only trained and authorised people fight fires, and only when it is safe. Your job is to evacuate.", ar: "إطفاء الحريق للمدرّبين والمخوّلين فقط وعندما يكون آمناً. مهمتك هي الإخلاء." } },
      { ok: true, fx: "good",
        t: { en: "Stop work and evacuate by the safe route to the assembly point", ar: "أوقف العمل وأخلي المكان عبر الطريق الآمن إلى نقطة التجمع" },
        r: { en: "Now go: follow the green exit signs, keep away from the fire and stay out of restricted areas.", ar: "انطلق الآن: اتبع لافتات الخروج الخضراء، وابتعد عن النار، ولا تدخل المناطق المحظورة." } },
      { fx: "smoke",
        t: { en: "Finish my task first", ar: "أنهي مهمتي أولاً" },
        r: { en: "Every second counts. When the alarm sounds, stop work and leave.", ar: "كل ثانية مهمة. عندما يرن الإنذار، أوقف العمل وغادر." } },
    ],
    learn: { en: "When the alarm sounds: stop, evacuate by the safe route and report at the assembly point. Routes in this game are illustrative.", ar: "عندما يرن الإنذار: توقّف، وأخلِ المكان عبر الطريق الآمن، وسجّل حضورك في نقطة التجمع. المسارات في اللعبة توضيحية." },
  },
];

// Rule violations that can happen anywhere in the hall.
export const VIOLATIONS = {
  crane: {
    t: { en: "Under a suspended load", ar: "تحت حمل معلّق" },
    r: { en: "You walked under the crane load. The operator stopped and sounded the horn. Loads can slip or swing, so never stand or walk beneath them.", ar: "مشيت تحت حمل الرافعة. توقّف المشغّل وأطلق التنبيه. الأحمال قد تنزلق أو تتأرجح، فلا تقف ولا تمشِ تحتها أبداً." },
  },
  restricted: {
    t: { en: "Restricted area entered", ar: "دخول منطقة محظورة" },
    r: { en: "This area is for authorised, trained personnel only. Hazards here can include strong magnetic fields and very hot surfaces. Use the designated walkway.", ar: "هذه المنطقة للمخوّلين والمدرّبين فقط. قد تشمل مخاطرها مجالات مغناطيسية قوية وأسطحاً شديدة الحرارة. استخدم الممر المخصص." },
  },
  fire: {
    t: { en: "Too close to the fire", ar: "اقتربت كثيراً من النار" },
    r: { en: "Smoke and heat spread fast. Keep well away from the fire and use another route.", ar: "الدخان والحرارة ينتشران بسرعة. ابتعد عن النار واسلك طريقاً آخر." },
  },
};

// Camera mode: hazards placed around the trainee over the live camera view.
// Molten metal and the blocked walkway reuse the mission content above.
export const AR_FIRE = {
  id: "fire",
  name: { en: "Fire near equipment", ar: "حريق قرب المعدات" },
  q: { en: "Smoke and flames are coming from a bin next to equipment, and nobody has raised the alarm.", ar: "يخرج دخان ولهب من سلة بجانب المعدات، ولم يُطلق أحد الإنذار." },
  opts: [
    { ok: true, fx: "good",
      t: { en: "Raise the alarm, warn others and leave by the safe route", ar: "أطلق الإنذار، وأنبّه الآخرين، وأغادر عبر الطريق الآمن" },
      r: { en: "The alarm brought the trained response team and everyone left safely.", ar: "وصل فريق الاستجابة المدرّب بسبب الإنذار، وخرج الجميع بأمان." } },
    { fx: "smoke",
      t: { en: "Go closer to see what is burning", ar: "أقترب لأرى ما الذي يحترق" },
      r: { en: "The fire grew and smoke filled the area around you. Never approach a fire to look.", ar: "كبرت النار وامتلأ المكان حولك بالدخان. لا تقترب من حريق لتنظر." } },
    { fx: "smoke",
      t: { en: "Try to put it out myself without telling anyone", ar: "أحاول إطفاءها بنفسي دون أن أخبر أحداً" },
      r: { en: "The fire grew and nobody knew you needed help. Only trained, authorised people fight fires, after the alarm.", ar: "كبرت النار ولم يعرف أحد أنك تحتاج مساعدة. الإطفاء للمدرّبين والمخوّلين فقط وبعد إطلاق الإنذار." } },
  ],
  learn: { en: "Alarm and warn first, then leave by the safe route. Firefighting is only for trained, authorised people.", ar: "الإنذار والتنبيه أولاً، ثم المغادرة عبر الطريق الآمن. الإطفاء للمدرّبين والمخوّلين فقط." },
};

export const AR_CRANE = {
  id: "crane",
  name: { en: "Suspended load", ar: "حمل معلّق" },
  q: { en: "A crane is holding a heavy load above the walkway you are about to use.", ar: "رافعة تحمل حملاً ثقيلاً فوق الممر الذي ستسلكه." },
  opts: [
    { fx: "fall",
      t: { en: "Walk quickly underneath before it moves", ar: "أمرّ من تحته بسرعة قبل أن يتحرك" },
      r: { en: "The load slipped and landed right where you were heading. Never walk under a suspended load.", ar: "انزلق الحمل وسقط في المكان الذي كنت تتجه إليه. لا تمشِ أبداً تحت حمل معلّق." } },
    { ok: true, fx: "good",
      t: { en: "Stay outside the load’s path and wait until it is set down", ar: "أبقى خارج مسار الحمل وأنتظر حتى يُنزَل" },
      r: { en: "The load was lowered safely and you crossed once the path was clear.", ar: "أُنزل الحمل بأمان وعبرتَ بعد أن أصبح الطريق خالياً." } },
    { fx: "fall",
      t: { en: "Wave to the operator to hold it so I can pass underneath", ar: "أشير للمشغّل ليوقفه حتى أمرّ من تحته" },
      r: { en: "Even a stopped load can slip or swing. The load dropped. Go around, or wait until it is set down.", ar: "حتى الحمل المتوقف قد ينزلق أو يتأرجح، وقد سقط. التفّ حوله أو انتظر حتى يُنزَل." } },
  ],
  learn: { en: "Never stand or walk under a suspended load. Keep clear of its path and wait.", ar: "لا تقف ولا تمشِ تحت حمل معلّق. ابتعد عن مساره وانتظر." },
};
