// Training content. Everything a trainer may want to change lives here, so it can be
// reviewed by HSE and later loaded from a server instead of being hard-coded.
// `approved: false` keeps the "sample content" banner visible in the game.
// All scenarios are illustrative and set in a fictional smelter.

export const CONTENT_META = {
  version: "0.2-sample",
  approved: false,
};

const L = (en, ar) => ({ en, ar });

// Difficulty tuning.
export const DIFFICULTY = {
  easy:   { craneSpeed: 1.6, forkSpeed: 2.4, evacSeconds: 150, huntSeconds: 210, hazards: 5, showArrow: true,  showDanger: true,  showMarkers: true },
  normal: { craneSpeed: 2.4, forkSpeed: 3.2, evacSeconds: 110, huntSeconds: 160, hazards: 6, showArrow: true,  showDanger: false, showMarkers: true },
  hard:   { craneSpeed: 3.2, forkSpeed: 4.2, evacSeconds: 80,  huntSeconds: 120, hazards: 7, showArrow: false, showDanger: false, showMarkers: false },
};

// Each mission is scored out of 100. Mistakes subtract points; a finished mission never
// scores below `minimum`. Stars: 3 at 90+, 2 at 70+, otherwise 1.
export const SCORING = { max: 100, violation: 20, wrongChoice: 15, wrongCheck: 10, minor: 5, minimum: 10, stars: [90, 70] };

// PPE items for the PPE station. `need: true` items are required in this scenario.
export const PPE_ITEMS = [
  { id: "helmet",   need: true,  ...L("Hard hat", "خوذة صلبة") },
  { id: "glasses",  need: true,  ...L("Safety glasses", "نظارة سلامة") },
  { id: "fr",       need: true,  ...L("Flame-resistant (FR) clothing", "ملابس مقاومة للهب") },
  { id: "boots",    need: true,  ...L("Safety boots", "حذاء سلامة") },
  { id: "gloves",   need: true,  ...L("Heat-resistant gloves", "قفازات مقاومة للحرارة") },
  { id: "ears",     need: true,  ...L("Hearing protection", "واقي سمع") },
  { id: "fleece",   need: false, ...L("Synthetic fleece jacket", "سترة من قماش صناعي"),
    why: L("Synthetic fabric can melt onto skin near heat or molten metal.", "القماش الصناعي قد يذوب ويلتصق بالجلد قرب الحرارة أو المعدن المنصهر.") },
  { id: "trainers", need: false, ...L("Sports trainers", "حذاء رياضي"),
    why: L("Trainers give no protection from heavy objects, heat or sharp edges.", "الحذاء الرياضي لا يحمي من الأجسام الثقيلة أو الحرارة أو الحواف الحادة.") },
];

// PPE inspection bench (mission 2). Defects are chosen at random each time.
export const PPE_CHECK = {
  helmet:  { name: L("Hard hat", "خوذة صلبة"),
    ok: L("The shell is smooth with no cracks, and the harness inside is intact.", "الغلاف أملس بلا شقوق، والحزام الداخلي سليم."),
    bad: L("There is a crack running across the shell.", "يوجد شق يمتد عبر غلاف الخوذة."),
    badUse: L("A cracked shell may break under impact. Damaged PPE must be tagged out and replaced.", "الغلاف المشقوق قد ينكسر عند الصدمة. معدات الوقاية التالفة يجب سحبها ووسمها واستبدالها.") },
  glasses: { name: L("Safety glasses", "نظارة سلامة"),
    ok: L("The lens is clear and unscratched and the arms are firm.", "العدسة صافية بلا خدوش والذراعان ثابتتان."),
    bad: L("The lens has a deep crack.", "في العدسة شق عميق."),
    badUse: L("A cracked lens can shatter into your eye. Replace it before work.", "العدسة المشقوقة قد تتحطم داخل عينك. استبدلها قبل العمل.") },
  gloves:  { name: L("Heat-resistant gloves", "قفازات مقاومة للحرارة"),
    ok: L("The leather is whole with no holes or thin spots.", "الجلد سليم بلا ثقوب أو مواضع رقيقة."),
    bad: L("One glove has a hole burnt through the palm.", "أحد القفازين فيه ثقب محترق في راحة اليد."),
    badUse: L("Heat and molten splashes go straight through a hole. Tag out damaged gloves.", "الحرارة ورذاذ المعدن ينفذان مباشرة من الثقب. اسحب القفازات التالفة وضع عليها وسماً.") },
  jacket:  { name: L("FR jacket", "سترة مقاومة للهب"),
    ok: L("The fabric is clean, with no burns, tears or oil soaking.", "القماش نظيف بلا حروق أو تمزق أو تشرّب بالزيت."),
    bad: L("There is a scorched hole in the front panel.", "يوجد ثقب محروق في الجزء الأمامي."),
    badUse: L("Damaged FR clothing no longer protects you from flame and heat.", "الملابس المقاومة للهب التالفة لم تعد تحميك من اللهب والحرارة.") },
  boots:   { name: L("Safety boots", "حذاء سلامة"),
    ok: L("Soles are intact and the toe caps are undamaged.", "النعل سليم وواقيات الأصابع غير متضررة."),
    bad: L("The sole is coming away from the boot.", "النعل منفصل عن الحذاء."),
    badUse: L("A loose sole is a trip hazard and lets heat through.", "النعل المنفصل يسبب التعثّر ويسمح بنفاذ الحرارة.") },
  goodTag: L("This item was in good condition. Tagging out good PPE is not unsafe, but it leaves the crew short of kit.", "كانت هذه القطعة بحالة جيدة. سحب المعدات السليمة ليس خطراً، لكنه يترك الفريق بلا معدات كافية."),
};

// Hazard categories used by the Hazard Hunter.
export const HAZARD_CATS = {
  slip: L("Slip or trip", "انزلاق أو تعثّر"),
  fire: L("Fire or explosion", "حريق أو انفجار"),
  struck: L("Struck by a falling or moving object", "اصطدام بجسم ساقط أو متحرك"),
  elec: L("Electrical", "كهربائي"),
  machine: L("Moving machinery or entanglement", "آلات متحركة أو انحشار"),
  fall: L("Fall from height or into an opening", "سقوط من ارتفاع أو في فتحة"),
  none: L("No hazard: this is safe as it is", "لا يوجد خطر: الوضع آمن كما هو"),
};

// Hazard Hunter spots. Each run picks some to be hazards and leaves the rest in a safe state.
export const HUNT_SPOTS = [
  { id: "gas", cat: "struck", x: -18, z: 11.4,
    name: L("Gas cylinders", "أسطوانات الغاز"),
    bad: L("A gas cylinder is standing on its own, not chained or in a trolley.", "أسطوانة غاز واقفة وحدها، غير مربوطة بسلسلة ولا في عربة."),
    good: L("The gas cylinders are chained upright in a cylinder trolley.", "أسطوانات الغاز مربوطة بسلسلة وقائمة داخل عربة الأسطوانات."),
    learn: L("Unsecured cylinders can fall, break the valve and become a projectile. Always chain them upright.", "الأسطوانات غير المثبتة قد تسقط وينكسر صمامها فتندفع كالقذيفة. اربطها دائماً وهي قائمة.") },
  { id: "ext", cat: "fire", x: -12, z: 14.55,
    name: L("Fire extinguisher", "طفاية الحريق"),
    bad: L("Stacked boxes are blocking access to the fire extinguisher.", "صناديق مكدّسة تمنع الوصول إلى طفاية الحريق."),
    good: L("The extinguisher is on its bracket with a clear marked area in front.", "الطفاية على حاملها وأمامها مساحة خالية ومحددة."),
    learn: L("Fire equipment must always be reachable. Keep the marked area in front of it clear.", "معدات الحريق يجب أن تكون في المتناول دائماً. أبقِ المساحة المحددة أمامها خالية.") },
  { id: "cable", cat: "elec", x: -4, z: 9,
    name: L("Power cable", "كابل الكهرباء"),
    bad: L("A damaged power cable with exposed wires lies across the walkway.", "كابل كهرباء تالف بأسلاك مكشوفة ممدود عبر ممر المشاة."),
    good: L("The cable runs inside a yellow cable protector across the walkway.", "الكابل يمر داخل واقي كابلات أصفر عبر الممر."),
    learn: L("Damaged cables can cause electric shock and fire. Isolate, report and keep people away.", "الكابلات التالفة قد تسبب صعقاً كهربائياً وحريقاً. افصلها وأبلغ عنها وأبعد الناس عنها.") },
  { id: "oil", cat: "slip", x: 2, z: 10.6,
    name: L("Floor", "الأرضية"),
    bad: L("There is an oil spill on the walkway with nobody attending it.", "يوجد تسرّب زيت على ممر المشاة ولا أحد يتعامل معه."),
    good: L("A spill kit is in place next to the walkway, ready for use.", "حقيبة التعامل مع الانسكابات موجودة بجانب الممر وجاهزة للاستخدام."),
    learn: L("Spills cause slips. Cordon off, report and clean up with a spill kit.", "الانسكابات تسبب الانزلاق. اعزل المكان وأبلغ ونظّف بحقيبة الانسكابات.") },
  { id: "stack", cat: "struck", x: 7, z: 11.4,
    name: L("Stored material", "المواد المخزّنة"),
    bad: L("Pallets of boxes are stacked too high and leaning.", "منصات الصناديق مكدّسة عالياً جداً ومائلة."),
    good: L("One pallet of boxes, stacked low and stable.", "منصة واحدة من الصناديق، مكدّسة بارتفاع منخفض وثابتة."),
    learn: L("Unstable stacks can collapse onto people. Keep stacks low, square and stable.", "التكديس غير الثابت قد ينهار على الأشخاص. أبقِ التكديس منخفضاً ومستوياً وثابتاً.") },
  { id: "ladder", cat: "fall", x: 20, z: 9.4,
    name: L("Ladder", "السلّم"),
    bad: L("A ladder with a broken rung is left leaning, unsecured.", "سلّم بدرجة مكسورة متروك مائلاً وغير مثبّت."),
    good: L("The ladder is stored flat on its wall rack.", "السلّم مخزّن أفقياً على حامله في الجدار."),
    learn: L("Damaged ladders must be tagged out. Never leave a ladder standing unsecured.", "السلالم التالفة يجب سحبها ووسمها. لا تترك سلّماً واقفاً دون تثبيت.") },
  { id: "grinder", cat: "machine", x: 18.5, z: 13.95,
    name: L("Bench grinder", "جلّاخة الطاولة"),
    bad: L("The bench grinder is running with its guard removed.", "جلّاخة الطاولة تعمل وقد أُزيل واقيها."),
    good: L("The grinder is switched off and its guard is fitted.", "الجلّاخة مطفأة وواقيها مركّب."),
    learn: L("Guards stop contact with moving parts and catch fragments. Never run a machine without its guard.", "الواقيات تمنع ملامسة الأجزاء المتحركة وتصد الشظايا. لا تشغّل آلة دون واقيها.") },
  { id: "drum", cat: "fire", x: 24.6, z: 10.6,
    name: L("Solvent drum", "برميل المذيبات"),
    bad: L("An open drum of flammable solvent is next to a hot-work area.", "برميل مذيبات قابلة للاشتعال مفتوح بجانب منطقة أعمال ساخنة."),
    good: L("The solvent drum is closed and standing in a spill tray.", "برميل المذيبات مغلق وموضوع في حوض احتواء."),
    learn: L("Flammable vapour can ignite from sparks. Keep containers closed and away from hot work.", "الأبخرة القابلة للاشتعال قد تشتعل من الشرر. أبقِ الحاويات مغلقة وبعيدة عن الأعمال الساخنة.") },
  { id: "hose", cat: "slip", x: -24, z: 9,
    name: L("Water hose", "خرطوم الماء"),
    bad: L("A hose is lying loose across the walkway.", "خرطوم ممدود بشكل سائب عبر ممر المشاة."),
    good: L("The hose is coiled on its reel beside the walkway.", "الخرطوم ملفوف على بكرته بجانب الممر."),
    learn: L("Walkways must stay clear. Report trip hazards and reroute hoses safely.", "ممرات المشاة يجب أن تبقى خالية. أبلغ عن عوائق التعثّر وأعد توجيه الخراطيم بأمان.") },
  { id: "hatch", cat: "fall", x: 10.5, z: 7,
    name: L("Floor hatch", "فتحة الأرضية"),
    bad: L("A floor hatch is open with no barrier around it.", "فتحة في الأرضية مفتوحة بلا حاجز حولها."),
    good: L("The floor hatch is closed and flush with the floor.", "فتحة الأرضية مغلقة ومستوية مع الأرض."),
    learn: L("Open floor openings must be guarded with barriers or covered.", "الفتحات المفتوحة في الأرضية يجب أن تُحاط بحواجز أو تُغطّى.") },
];

// Rule violations that can happen anywhere in the hall.
export const VIOLATIONS = {
  crane: {
    t: L("Under a suspended load", "تحت حمل معلّق"),
    r: L("You walked under the crane load. The operator stopped and sounded the horn. Loads can slip or swing, so never stand or walk beneath them.", "مشيت تحت حمل الرافعة. توقّف المشغّل وأطلق التنبيه. الأحمال قد تنزلق أو تتأرجح، فلا تقف ولا تمشِ تحتها أبداً."),
  },
  restricted: {
    t: L("Restricted area entered", "دخول منطقة محظورة"),
    r: L("This area is for authorised, trained personnel only. Hazards here can include strong magnetic fields and very hot surfaces. Use the designated walkway.", "هذه المنطقة للمخوّلين والمدرّبين فقط. قد تشمل مخاطرها مجالات مغناطيسية قوية وأسطحاً شديدة الحرارة. استخدم الممر المخصص."),
  },
  fire: {
    t: L("Too close to the fire", "اقتربت كثيراً من النار"),
    r: L("Smoke and heat spread fast. Keep well away from the fire and use another route.", "الدخان والحرارة ينتشران بسرعة. ابتعد عن النار واسلك طريقاً آخر."),
  },
  forklift: {
    t: L("Struck by a forklift", "صدمتك رافعة شوكية"),
    r: L("You stepped into the path of a moving forklift. Drivers may not see you, and a loaded forklift cannot stop quickly. Stop, look both ways and make eye contact before crossing.", "دخلت في مسار رافعة شوكية متحركة. قد لا يراك السائق، والرافعة المحمّلة لا تستطيع التوقف بسرعة. توقّف وانظر في الاتجاهين وتواصل بصرياً مع السائق قبل العبور."),
  },
  aisle: {
    t: L("Walking in the vehicle aisle", "المشي في ممر المركبات"),
    r: L("Pedestrians must stay on the green walkway and cross the aisle only at the marked crossings.", "يجب على المشاة البقاء في الممر الأخضر وعبور ممر المركبات من نقاط العبور المحددة فقط."),
  },
  fall: {
    t: L("Unclipped near an open edge", "قرب حافة مفتوحة دون تثبيت الحزام"),
    r: L("Part of the guardrail is removed for maintenance. Within reach of an open edge you must be clipped to the anchor point.", "جزء من الحاجز مُزال للصيانة. عندما تكون قرب حافة مفتوحة يجب أن تثبّت حزامك بنقطة التثبيت."),
  },
  noLook: {
    t: L("Crossed without stopping to look", "عبرت دون أن تتوقف وتنظر"),
    r: L("A forklift driver had to brake hard. At every crossing: stop at the line, look both ways, then cross.", "اضطر سائق رافعة شوكية إلى الفرملة بقوة. عند كل نقطة عبور: قف عند الخط، وانظر في الاتجاهين، ثم اعبر."),
  },
};

// ------------------------------------------------------------------------------------
// Missions. Names, briefings, objectives and lessons. Gameplay logic is in missions.js.
// ------------------------------------------------------------------------------------
export const MISSION_TEXT = {
  induction: {
    name: L("Safety Induction", "التعريف بالسلامة"),
    short: L("Explore the hall and find the safety equipment you will need.", "استكشف الصالة وتعرّف على معدات السلامة التي ستحتاجها."),
    brief: L("Welcome to the potroom. Before you start work, read the induction board, then find the emergency exit, a fire alarm call point and the eyewash station. Finish at the outdoor assembly point. Cross the vehicle aisle only at the marked crossings.", "مرحباً بك في صالة الخلايا. قبل أن تبدأ العمل، اقرأ لوحة التعريف، ثم اعثر على مخرج الطوارئ ونقطة إنذار الحريق ومحطة غسيل العيون. أنهِ المهمة عند نقطة التجمع الخارجية. اعبر ممر المركبات من نقاط العبور المحددة فقط."),
    obj: {
      board: L("Read the induction board", "اقرأ لوحة التعريف"),
      exit: L("Find the emergency exit", "اعثر على مخرج الطوارئ"),
      call: L("Find a fire alarm call point", "اعثر على نقطة إنذار الحريق"),
      eyewash: L("Find the emergency eyewash", "اعثر على محطة غسيل العيون"),
      assembly: L("Go out to the assembly point", "اخرج إلى نقطة التجمع"),
    },
    boardT: L("Site safety rules", "قواعد السلامة في الموقع"),
    boardB: L("Wear the full PPE for the area at all times. Stay on the green walkway. Cross the aisle only at zebra crossings. Never walk under a suspended load. Report every hazard and near miss. When the alarm sounds, stop work and go to the assembly point.", "ارتدِ معدات الوقاية الكاملة للمنطقة في كل الأوقات. ابقَ في الممر الأخضر. اعبر ممر المركبات من خطوط العبور فقط. لا تمشِ أبداً تحت حمل معلّق. أبلغ عن كل خطر وكل حادث كاد أن يقع. عندما يرن الإنذار، أوقف العمل واذهب إلى نقطة التجمع."),
    exitB: L("This is the nearest emergency exit. The route to it must always be kept clear, and the door must never be locked or blocked.", "هذا أقرب مخرج طوارئ. يجب أن يبقى الطريق إليه خالياً دائماً، ولا يجوز قفل الباب أو سدّه."),
    callB: L("Break the glass and press to raise the fire alarm. Only use it in a real emergency. In this mission, just note where it is.", "اكسر الزجاج واضغط لإطلاق إنذار الحريق. استخدمه في الطوارئ الحقيقية فقط. في هذه المهمة تعرّف على مكانه فقط."),
    eyewashB: L("If something gets in your eyes, rinse them here for at least 15 minutes and call for help.", "إذا دخل شيء في عينيك، اغسلهما هنا 15 دقيقة على الأقل واطلب المساعدة."),
    learn: L("Know your exits, call points and first-aid equipment before you start work, and always use the walkway and crossings.", "اعرف المخارج ونقاط الإنذار ومعدات الإسعاف قبل أن تبدأ العمل، واستخدم دائماً الممر وخطوط العبور."),
  },
  ppe: {
    name: L("PPE Challenge", "تحدي معدات الوقاية"),
    short: L("Choose the right PPE, then inspect it and tag out anything damaged.", "اختر معدات الوقاية الصحيحة، ثم افحصها واسحب كل قطعة تالفة."),
    brief: L("Collect your PPE at the PPE station. Then inspect each item on the inspection bench: use the items in good condition and tag out anything damaged. When you are ready, walk through the PPE checkpoint into the potroom.", "استلم معدات الوقاية من المحطة. ثم افحص كل قطعة على طاولة الفحص: استخدم القطع السليمة واسحب كل قطعة تالفة. عندما تكون جاهزاً، امشِ عبر نقطة فحص المعدات إلى صالة الخلايا."),
    obj: {
      select: L("Choose your PPE at the PPE station", "اختر معداتك من محطة معدات الوقاية"),
      inspect: L("Inspect every item on the bench ({n} left)", "افحص كل قطعة على الطاولة (باقي {n})"),
      go: L("Walk through the PPE checkpoint", "امشِ عبر نقطة فحص المعدات"),
    },
    use: L("Use it", "استخدمها"), tag: L("Tag it out", "اسحبها وضع وسماً"),
    learn: L("Pick the right PPE for the area and inspect it before every use. Damaged PPE is tagged out and replaced.", "اختر المعدات المناسبة للمنطقة وافحصها قبل كل استخدام. المعدات التالفة تُسحب ويوضع عليها وسم وتُستبدل."),
  },
  hunter: {
    name: L("Hazard Hunter", "صيّاد المخاطر"),
    short: L("Against the clock: find and classify the hazards. Not everything is a hazard.", "في سباق مع الوقت: اعثر على المخاطر وصنّفها. ليس كل شيء خطراً."),
    brief: L("Hazards have been left along the walkway and in the workshop. Inspect anything that looks wrong and say what kind of hazard it is. Some things are safe, so look carefully. Find them all before the time runs out. The hazards change every time you play.", "تُركت مخاطر على طول الممر وداخل الورشة. افحص كل ما يبدو خاطئاً وحدّد نوع الخطر. بعض الأشياء آمنة، فانظر بعناية. اعثر عليها كلها قبل أن ينتهي الوقت. المخاطر تتغير في كل مرة تلعب فيها."),
    obj: { find: L("Find and classify the hazards ({n} left)", "اعثر على المخاطر وصنّفها (باقي {n})") },
    q: L("What do you see?", "ماذا ترى؟"),
    right: L("Correct", "صحيح"),
    wrongCat: L("Not quite", "ليس تماماً"),
    falseAlarm: L("This one was safe", "هذا كان آمناً"),
    missed: L("You missed a hazard", "فاتك خطر"),
    timeUp: L("Time is up. These hazards were still there:", "انتهى الوقت. هذه المخاطر كانت لا تزال موجودة:"),
    learn: L("Look for hazards everywhere you work, report them, and learn to tell a safe set-up from an unsafe one.", "ابحث عن المخاطر في كل مكان تعمل فيه، وأبلغ عنها، وتعلّم أن تميّز الوضع الآمن من غير الآمن."),
  },
  machinery: {
    name: L("Moving Machinery", "الآلات المتحركة"),
    short: L("Carry a toolbox across a live vehicle aisle with a forklift and crane.", "احمل صندوق عدة عبر ممر مركبات نشط فيه رافعة شوكية ورافعة علوية."),
    brief: L("A maintenance crew in the tapping bay needs a toolbox. Pick it up, carry it across the vehicle aisle and hand it over, then return to the walkway. A forklift and the overhead crane are working. Stop at the line, look both ways and cross only on the zebra crossing.", "طاقم صيانة في منطقة السحب يحتاج صندوق عدة. خذه، واحمله عبر ممر المركبات وسلّمه، ثم ارجع إلى ممر المشاة. الرافعة الشوكية والرافعة العلوية تعملان. قف عند الخط وانظر في الاتجاهين واعبر من خط العبور فقط."),
    obj: {
      pick: L("Pick up the toolbox", "خذ صندوق العدة"),
      stop: L("Stop at the line before the crossing", "قف عند الخط قبل نقطة العبور"),
      look: L("Look both ways: left {l}  right {r}", "انظر في الاتجاهين: يسار {l}  يمين {r}"),
      cross: L("Cross when it is clear and hand over the toolbox", "اعبر عندما يكون الطريق خالياً وسلّم صندوق العدة"),
      back: L("Return to the walkway using the crossing", "ارجع إلى ممر المشاة عبر خط العبور"),
    },
    handT: L("Toolbox delivered", "تم تسليم صندوق العدة"),
    handB: L("The crew thanks you. Now head back safely: the forklift is still working.", "شكرك الطاقم. ارجع الآن بأمان، فالرافعة الشوكية ما زالت تعمل."),
    learn: L("Stay on walkways, stop and look both ways at crossings, and never walk under loads or into the path of vehicles.", "ابقَ في ممرات المشاة، وقف وانظر في الاتجاهين عند العبور، ولا تمشِ تحت الأحمال أو في مسار المركبات."),
  },
  molten: {
    name: L("Molten Metal Safety", "سلامة المعدن المنصهر"),
    short: L("Make the tapping bay safe before the crucible moves.", "اجعل منطقة السحب آمنة قبل تحريك البوتقة."),
    brief: L("A crucible of molten metal is ready to move. Before you give the ready signal, make the bay safe: water and damp tools must be removed, nobody may stand in the line of fire, and you need your face shield. Signal only when everything is done.", "بوتقة فيها معدن منصهر جاهزة للتحريك. قبل أن تعطي إشارة الجاهزية، اجعل المنطقة آمنة: يجب إزالة الماء والأدوات الرطبة، ولا يقف أحد في خط الخطر، وتحتاج إلى واقي الوجه. أعطِ الإشارة فقط بعد إكمال كل شيء."),
    obj: {
      valve: L("Stop the water leak", "أوقف تسرّب الماء"),
      tool: L("Move the wet tool to the drying rack", "انقل الأداة المبللة إلى رف التجفيف"),
      toolCarry: L("Put the wet tool on the drying rack", "ضع الأداة المبللة على رف التجفيف"),
      worker: L("Get the worker out of the line of fire", "أبعد العامل عن خط الخطر"),
      shield: L("Put on your face shield", "ارتدِ واقي الوجه"),
      signal: L("Give the ready signal", "أعطِ إشارة الجاهزية"),
    },
    workerQ: L("A worker is standing between the crucible and the wet floor. What do you tell him?", "عامل يقف بين البوتقة والأرض المبللة. ماذا تقول له؟"),
    workerOpts: [
      { ok: true, t: L("Ask him to move behind the yellow line until the crucible has passed", "أطلب منه الانتقال خلف الخط الأصفر حتى تمر البوتقة"), r: L("He moves to a safe position behind the line.", "انتقل إلى مكان آمن خلف الخط.") },
      { t: L("Let him stay, he is experienced", "أتركه، فهو صاحب خبرة"), r: L("Experience does not stop molten splashes. Nobody may stand in the line of fire during a move.", "الخبرة لا تمنع رذاذ المعدن المنصهر. لا يجوز لأحد الوقوف في خط الخطر أثناء النقل.") },
      { t: L("Ask him to mop up the water quickly", "أطلب منه مسح الماء بسرعة"), r: L("Mopping next to molten metal keeps him in danger and spreads moisture. Stop the leak at the source first.", "المسح بجانب المعدن المنصهر يبقيه في الخطر وينشر الرطوبة. أوقف التسرّب من مصدره أولاً.") },
    ],
    earlyT: L("Steam explosion", "انفجار بخاري"),
    earlyB: L("The crucible moved before the bay was safe. Water trapped under molten metal turns to steam instantly and throws metal out. Still not done:", "تحركت البوتقة قبل أن تصبح المنطقة آمنة. الماء المحبوس تحت المعدن المنصهر يتحول إلى بخار فوراً ويقذف المعدن. ما لم يُنجز بعد:"),
    doneB: L("The bay is dry, the crew is clear and the crucible moved safely.", "المنطقة جافة والطاقم بعيد، وتحركت البوتقة بأمان."),
    learn: L("Molten metal and water never mix. Remove moisture, keep people out of the line of fire and wear the right PPE before any move.", "المعدن المنصهر والماء لا يجتمعان أبداً. أزل الرطوبة، وأبعد الناس عن خط الخطر، وارتدِ المعدات المناسبة قبل أي نقل."),
  },
  highrisk: {
    name: L("High-Risk Work", "الأعمال عالية الخطورة"),
    short: L("Lock out a conveyor and work at height, in the right order.", "اعزل سيراً ناقلاً واقفله، ثم اعمل على ارتفاع، بالترتيب الصحيح."),
    brief: L("Conveyor C-3 on the maintenance platform is jammed. Follow the safe system of work in order: collect the permit, isolate the right conveyor, fit your lock and tag, test that it cannot start, clip your harness on at the platform, then clear the jam.", "السير الناقل C-3 على منصة الصيانة عالق. اتبع نظام العمل الآمن بالترتيب: استلم التصريح، واعزل السير الصحيح، وضع قفلك ووسمك، واختبر أنه لا يعمل، وثبّت حزامك على المنصة، ثم أزل العائق."),
    obj: {
      permit: L("Collect the work permit", "استلم تصريح العمل"),
      isolate: L("Isolate conveyor C-3", "اعزل السير الناقل C-3"),
      lock: L("Fit your lock and tag", "ضع قفلك ووسمك"),
      test: L("Try to start it at the local control station", "حاول تشغيله من محطة التحكم المحلية"),
      clip: L("Clip your harness to the anchor point", "ثبّت حزامك بنقطة التثبيت"),
      clear: L("Clear the jam at the end of the conveyor", "أزل العائق في نهاية السير"),
    },
    noPermitT: L("No permit", "لا يوجد تصريح"),
    noPermitB: L("Isolation and maintenance work need a valid permit first. Collect the permit.", "العزل وأعمال الصيانة تحتاج تصريحاً سارياً أولاً. استلم التصريح."),
    wrongIsoT: L("The conveyor is still running", "السير ما زال يعمل"),
    wrongIsoB: L("The test showed that C-3 is still live: you isolated the wrong conveyor. Undo it and isolate C-3. This is why we test before touching anything.", "أظهر الاختبار أن C-3 ما زال يعمل: لقد عزلت السير الخطأ. ألغِ ذلك واعزل C-3. لهذا نختبر دائماً قبل لمس أي شيء."),
    testOkT: L("Isolation confirmed", "تم تأكيد العزل"),
    testOkB: L("You pressed start and nothing happened. The conveyor is safely isolated.", "ضغطت زر التشغيل ولم يحدث شيء. السير معزول بأمان."),
    entangleT: L("Caught by the conveyor", "انحشرت في السير"),
    entangleB: L("The conveyor was not safely isolated and it moved while your hands were in the jam. Isolate, lock, tag and test before you touch any machine.", "لم يكن السير معزولاً بأمان فتحرك ويداك داخل العائق. اعزل واقفل وضع الوسم واختبر قبل أن تلمس أي آلة."),
    unlockedT: L("Someone switched it back on", "أعاد أحدهم تشغيله"),
    unlockedB: L("Without your personal lock, a colleague who did not know you were working switched the isolator back on.", "بدون قفلك الشخصي، أعاد زميل لم يكن يعلم بعملك تشغيل المفتاح."),
    skipTest: L("You did not test the isolation before starting work.", "لم تختبر العزل قبل بدء العمل."),
    doneB: L("The jam is cleared with the conveyor safely isolated and you clipped on at height.", "أُزيل العائق والسير معزول بأمان، وكنت مثبتاً بالحزام على الارتفاع."),
    learn: L("Permit, isolate, lock, tag, test. Then work, and at height always stay clipped on near an open edge.", "تصريح، عزل، قفل، وسم، اختبار. ثم العمل، وعلى الارتفاع ابقَ مثبتاً بالحزام دائماً قرب الحافة المفتوحة."),
  },
  emergency: {
    name: L("Emergency Response", "الاستجابة للطوارئ"),
    short: L("Raise the alarm, evacuate through the smoke and report to the warden.", "أطلق الإنذار، وأخلِ المكان عبر الدخان، وأبلغ مسؤول الإخلاء."),
    brief: L("Something is burning somewhere in the hall and nobody has raised the alarm yet. Find the nearest call point and raise the alarm, then evacuate to the assembly point. Avoid the smoke: the exposure meter shows how much you are breathing in. The fire starts in a different place each time.", "هناك شيء يحترق في مكان ما داخل الصالة ولم يطلق أحد الإنذار بعد. اعثر على أقرب نقطة إنذار وأطلق الإنذار، ثم أخلِ المكان إلى نقطة التجمع. تجنّب الدخان: مقياس التعرّض يبيّن كمية الدخان التي تستنشقها. الحريق يبدأ في مكان مختلف في كل مرة."),
    obj: {
      alarm: L("Raise the alarm at a call point", "أطلق الإنذار من نقطة إنذار"),
      evac: L("Evacuate to the assembly point", "أخلِ المكان إلى نقطة التجمع"),
      warden: L("Report to the warden", "أبلغ مسؤول الإخلاء"),
    },
    smoke: L("Smoke", "الدخان"),
    fireQ: L("You can see flames and smoke. What do you do?", "ترى لهباً ودخاناً. ماذا تفعل؟"),
    fireOpts: [
      { ok: true, t: L("Raise the alarm at the nearest call point, then leave", "أطلق الإنذار من أقرب نقطة ثم أغادر"), r: L("Find the nearest call point now.", "اعثر على أقرب نقطة إنذار الآن.") },
      { t: L("Go closer to see what is burning", "أقترب لأرى ما الذي يحترق"), r: L("Smoke can overcome you in a few breaths. Never approach a fire to look.", "الدخان قد يفقدك وعيك خلال أنفاس قليلة. لا تقترب من حريق لتنظر.") },
      { t: L("Try to put it out on my own before telling anyone", "أحاول إطفاءه وحدي قبل أن أخبر أحداً"), r: L("Nobody knows there is a fire and it is growing. Raise the alarm first. Firefighting is only for trained, authorised people.", "لا أحد يعلم بالحريق وهو يكبر. أطلق الإنذار أولاً. الإطفاء للمدرّبين والمخوّلين فقط.") },
    ],
    alarmOn: L("Alarm raised. Evacuate now!", "تم إطلاق الإنذار. أخلِ المكان الآن!"),
    slowAlarm: L("The alarm was raised late.", "تأخّر إطلاق الإنذار."),
    smokeT: L("Overcome by smoke", "فقدت وعيك من الدخان"),
    smokeB: L("You breathed in too much smoke. Smoke is the main killer in fires. Choose a route away from it, keep low and leave quickly.", "استنشقت كمية كبيرة من الدخان. الدخان هو القاتل الأول في الحرائق. اختر طريقاً بعيداً عنه، وانخفض، وغادر بسرعة."),
    timeT: L("Time ran out", "انتهى الوقت"),
    timeB: L("You did not reach the assembly point in time. In a real emergency, leave straight away by the safest route.", "لم تصل إلى نقطة التجمع في الوقت المحدد. في الطوارئ الحقيقية غادر فوراً عبر أكثر الطرق أماناً."),
    wardenQ: L("The warden is taking the headcount. You saw a contractor working in the workshop who is not here. What do you do?", "مسؤول الإخلاء يعدّ الحاضرين. رأيت مقاولاً يعمل في الورشة وهو غير موجود هنا. ماذا تفعل؟"),
    wardenOpts: [
      { ok: true, t: L("Tell the warden at once where you last saw him", "أخبر مسؤول الإخلاء فوراً أين رأيته آخر مرة"), r: L("The warden passes it to the emergency team, who know where to search.", "نقل مسؤول الإخلاء المعلومة إلى فريق الطوارئ فعرفوا أين يبحثون.") },
      { t: L("Go back inside to look for him", "أعود إلى الداخل للبحث عنه"), r: L("Going back in puts a second person at risk. Searching is for the trained emergency team.", "العودة إلى الداخل تعرّض شخصاً ثانياً للخطر. البحث مهمة فريق الطوارئ المدرّب.") },
      { t: L("Say nothing, he probably left another way", "لا أقول شيئاً، ربما خرج من طريق آخر"), r: L("If nobody reports him missing, nobody looks for him. Always tell the warden.", "إذا لم يبلّغ أحد عن غيابه فلن يبحث عنه أحد. أخبر مسؤول الإخلاء دائماً.") },
    ],
    learn: L("Raise the alarm first, evacuate away from smoke by the safest route, and report to the warden. Never go back inside.", "أطلق الإنذار أولاً، وأخلِ المكان بعيداً عن الدخان عبر أكثر الطرق أماناً، وأبلغ مسؤول الإخلاء. لا تعد إلى الداخل أبداً."),
  },
  final: {
    name: L("Final Safety Mission", "المهمة النهائية"),
    short: L("A full shift: PPE, a permit delivery through live traffic, hazards and an emergency.", "وردية كاملة: معدات الوقاية، وتوصيل تصريح عبر حركة نشطة، ومخاطر، وطوارئ."),
    brief: L("Your shift starts now. Gear up at the PPE station, collect the work permit and take it to the control room. Use the walkways and crossings: the crane and a forklift are working. Report any hazards you see on the way. Be ready for anything.", "تبدأ ورديتك الآن. جهّز معداتك من المحطة، واستلم تصريح العمل وخذه إلى غرفة التحكم. استخدم الممرات وخطوط العبور، فالرافعة العلوية والرافعة الشوكية تعملان. أبلغ عن أي مخاطر تراها في الطريق. كن مستعداً لأي شيء."),
    obj: {
      ppe: L("Gear up at the PPE station", "جهّز معداتك من محطة الوقاية"),
      permit: L("Collect the work permit from the bench", "استلم تصريح العمل من الطاولة"),
      deliver: L("Take the permit to the control room", "خذ التصريح إلى غرفة التحكم"),
      hazards: L("Hazards reported on the way: {n} of {total}", "مخاطر أبلغت عنها في الطريق: {n} من {total}"),
    },
    deliveredT: L("Permit delivered", "تم تسليم التصريح"),
    missedHaz: L("Hazards you walked past without reporting: {n}", "مخاطر مررت بها دون إبلاغ: {n}"),
    learn: L("Safety is a whole shift, not one task: the right PPE, safe routes, reporting hazards and responding to emergencies.", "السلامة طوال الوردية وليست مهمة واحدة: معدات الوقاية المناسبة، والطرق الآمنة، والإبلاغ عن المخاطر، والاستجابة للطوارئ."),
  },
};

export const MISSION_ORDER = ["induction", "ppe", "hunter", "machinery", "molten", "highrisk", "emergency", "final"];

// ------------------------------------------------------------------------------------
// Camera mode and AR scenarios (shared by ar.js and xr.js).
// ------------------------------------------------------------------------------------
export const AR_MOLTEN = {
  id: "molten",
  name: L("Molten metal and water", "المعدن المنصهر والماء"),
  q: L("A crucible of molten metal is about to move, and a hose is leaking water onto the floor of the bay.", "بوتقة فيها معدن منصهر على وشك التحرك، وخرطوم يسرّب الماء على أرضية المنطقة."),
  opts: [
    { fx: "steam", t: L("Mop it up quickly while the crucible moves in", "أمسحه بسرعة بينما تتحرك البوتقة"),
      r: L("The crucible arrived while the floor was still wet. Water trapped under molten metal can turn to steam instantly and throw metal out.", "وصلت البوتقة والأرض ما زالت مبللة. الماء المحبوس تحت المعدن المنصهر قد يتحول إلى بخار فوراً ويقذف المعدن.") },
    { ok: true, fx: "good", t: L("Keep clear, warn the crew to hold the move, and report the leak so the area is made dry", "أبتعد، وأنبّه الطاقم لإيقاف النقل، وأبلغ عن التسرّب حتى تُجفَّف المنطقة"),
      r: L("The move was held until the bay was dry and the leak fixed.", "أوقِف النقل حتى جفّت المنطقة وأُصلح التسرّب.") },
    { fx: "steam", t: L("Ignore it, it is only a little water", "أتجاهله، إنه ماء قليل فقط"),
      r: L("Even a small amount of water can cause a violent steam reaction with molten metal.", "حتى كمية صغيرة من الماء قد تسبب تفاعلاً بخارياً عنيفاً مع المعدن المنصهر.") },
  ],
  learn: L("Keep molten-metal areas dry. If you see water, moisture or damp tools, stop, warn and report.", "أبقِ مناطق المعدن المنصهر جافة. إذا رأيت ماءً أو رطوبة أو أدوات مبللة: توقّف، نبّه، وأبلغ."),
};

export const AR_WALKWAY = {
  id: "house",
  name: L("Blocked walkway", "ممر مشاة مسدود"),
  q: L("A hose and loose cables are lying across the pedestrian walkway.", "خرطوم وأسلاك سائبة ممدودة عبر ممر المشاة."),
  opts: [
    { ok: true, fx: "good", t: L("Warn people nearby and report it so it is cleared or rerouted safely", "أنبّه من حولي وأبلغ عنه ليُزال أو يُعاد توجيهه بأمان"),
      r: L("The hose was rerouted and the walkway is clear again.", "أُعيد توجيه الخرطوم وأصبح الممر خالياً من جديد.") },
    { fx: "trip", t: L("Step over it and carry on", "أتخطّاه وأكمل طريقي"),
      r: L("Your foot caught the hose and you stumbled. Trip hazards on walkways are a common cause of injury.", "علقت قدمك بالخرطوم وتعثّرت. عوائق الممرات من أكثر أسباب الإصابات شيوعاً.") },
    { fx: "trip", t: L("Leave it, someone else will deal with it", "أتركه، سيتعامل معه غيري"),
      r: L("A colleague carrying equipment did not see it and tripped. Safety is everyone’s responsibility.", "زميل يحمل معدات لم يره فتعثّر به. السلامة مسؤولية الجميع.") },
  ],
  learn: L("Walkways must stay clear. Report trip hazards, and only move loose items when it is safe to do so.", "ممرات المشاة يجب أن تبقى خالية. أبلغ عن عوائق التعثّر، ولا تحرّك إلا الأشياء السائبة وعندما يكون ذلك آمناً."),
};

export const AR_FIRE = {
  id: "fire",
  name: L("Fire near equipment", "حريق قرب المعدات"),
  q: L("Smoke and flames are coming from a bin next to equipment, and nobody has raised the alarm.", "يخرج دخان ولهب من سلة بجانب المعدات، ولم يُطلق أحد الإنذار."),
  opts: [
    { ok: true, fx: "good", t: L("Raise the alarm, warn others and leave by the safe route", "أطلق الإنذار، وأنبّه الآخرين، وأغادر عبر الطريق الآمن"),
      r: L("The alarm brought the trained response team and everyone left safely.", "وصل فريق الاستجابة المدرّب بسبب الإنذار، وخرج الجميع بأمان.") },
    { fx: "smoke", t: L("Go closer to see what is burning", "أقترب لأرى ما الذي يحترق"),
      r: L("The fire grew and smoke filled the area around you. Never approach a fire to look.", "كبرت النار وامتلأ المكان حولك بالدخان. لا تقترب من حريق لتنظر.") },
    { fx: "smoke", t: L("Try to put it out myself without telling anyone", "أحاول إطفاءها بنفسي دون أن أخبر أحداً"),
      r: L("The fire grew and nobody knew you needed help. Only trained, authorised people fight fires, after the alarm.", "كبرت النار ولم يعرف أحد أنك تحتاج مساعدة. الإطفاء للمدرّبين والمخوّلين فقط وبعد إطلاق الإنذار.") },
  ],
  learn: L("Alarm and warn first, then leave by the safe route. Firefighting is only for trained, authorised people.", "الإنذار والتنبيه أولاً، ثم المغادرة عبر الطريق الآمن. الإطفاء للمدرّبين والمخوّلين فقط."),
};

export const AR_CRANE = {
  id: "crane",
  name: L("Suspended load", "حمل معلّق"),
  q: L("A crane is holding a heavy load above the walkway you are about to use.", "رافعة تحمل حملاً ثقيلاً فوق الممر الذي ستسلكه."),
  opts: [
    { fx: "fall", t: L("Walk quickly underneath before it moves", "أمرّ من تحته بسرعة قبل أن يتحرك"),
      r: L("The load slipped and landed right where you were heading. Never walk under a suspended load.", "انزلق الحمل وسقط في المكان الذي كنت تتجه إليه. لا تمشِ أبداً تحت حمل معلّق.") },
    { ok: true, fx: "good", t: L("Stay outside the load’s path and wait until it is set down", "أبقى خارج مسار الحمل وأنتظر حتى يُنزَل"),
      r: L("The load was lowered safely and you crossed once the path was clear.", "أُنزل الحمل بأمان وعبرتَ بعد أن أصبح الطريق خالياً.") },
    { fx: "fall", t: L("Wave to the operator to hold it so I can pass underneath", "أشير للمشغّل ليوقفه حتى أمرّ من تحته"),
      r: L("Even a stopped load can slip or swing. The load dropped. Go around, or wait until it is set down.", "حتى الحمل المتوقف قد ينزلق أو يتأرجح، وقد سقط. التفّ حوله أو انتظر حتى يُنزَل.") },
  ],
  learn: L("Never stand or walk under a suspended load. Keep clear of its path and wait.", "لا تقف ولا تمشِ تحت حمل معلّق. ابتعد عن مساره وانتظر."),
};
