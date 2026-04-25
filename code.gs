// ═══════════════════════════════════════
//  code.gs — נקודת כניסה בלבד
// ═══════════════════════════════════════

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('ג׳וחא — כוח אדם')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * פונקציית עזר — מאפשרת ל-index.html לייבא קבצים אחרים
 * שימוש ב-HTML: <?!= include('style') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

