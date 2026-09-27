import type { HelpEntry, HelpCategory, FAQItem } from "./help-types";

/* ─── Route-specific help entries ─── */

export const helpEntries: HelpEntry[] = [
  {
    id: "search",
    route: "/",
    title: "Buscar jurisprudencia",
    icon: "search",
    summary: "Encuentra resoluciones judiciales del CENDOJ por texto libre, filtros de tribunal, fecha e identificadores.",
    sections: [
      {
        id: "QUE_ES",
        title: "¿Qué es?",
        content:
          "El buscador de jurisprudencia consulta la base de datos del Centro de Documentación Judicial (CENDOJ) del Consejo General del Poder Judicial. Puede buscar por texto libre, número ROJ, ECLI, número de recurso o combinaciones de filtros.",
      },
      {
        id: "PARA_QUE",
        title: "¿Para qué sirve?",
        content:
          "Para localizar resoluciones judiciales españolas: sentencias, autos y providencias de cualquier jurisdicción y nivel jerárquico. Útil para investigación jurídica, preparación de escritos y seguimiento de doctrina.",
      },
      {
        id: "COMO_USAR",
        title: "¿Cómo se usa?",
        content:
          "Escriba su consulta en el campo de búsqueda. Use filtros de tribunal, sala, jurisdicción y rango de fechas para afinar. Puede alternar entre búsqueda libre y el modo 'Encontrar sentencia' para pegar un enlace de noticia y que JURELIA intente localizar la resolución correspondiente.",
      },
      {
        id: "RESULTADOS",
        title: "¿Qué muestran los resultados?",
        content:
          "Cada resultado muestra el número ROJ, ECLI (si disponible), órgano judicial, fecha, ponente y un resumen oficial del CENDOJ. Puede abrir el PDF original, guardar en workspace o añadir a comparación.",
      },
      {
        id: "LIMITACIONES",
        title: "Limitaciones",
        content:
          "La búsqueda depende de la API del CENDOJ. Consultas muy genéricas pueden devolver resultados poco relevantes. El modo 'Encontrar sentencia' extrae metadatos de la noticia, pero no siempre consigue una coincidencia exacta.",
      },
      {
        id: "CONSEJOS",
        title: "Consejos",
        content:
          "Para mejores resultados: use términos jurídicos específicos, combine filtros de tribunal y fecha, y revise el panel de diagnóstico si los resultados no son los esperados. El campo ROJ acepta formatos como 'ROJ: STS 1234/2024'.",
      },
    ],
    keywords: ["buscar", "jurisprudencia", "sentencia", "resolución", "CENDOJ", "ROJ", "ECLI", "filtro", "tribunal"],
    related: ["compare", "proposition", "workspace"],
  },
  {
    id: "compare",
    route: "/compare",
    title: "Comparar resoluciones",
    icon: "compare",
    summary: "Análisis comparativo de dos resoluciones judiciales con identificación de similitudes, diferencias y doctrina aplicable.",
    sections: [
      {
        id: "QUE_ES",
        title: "¿Qué es?",
        content:
          "La herramienta de comparación analiza dos resoluciones judiciales y genera un informe estructurado que identifica: hechos relevantes, cuestiones jurídicas, ratio decidendi, doctrina aplicable y conclusiones de cada resolución.",
      },
      {
        id: "PARA_QUE",
        title: "¿Para qué sirve?",
        content:
          "Para evaluar si dos resoluciones siguen o contradicen la misma doctrina, identificar evolución jurisprudencial y preparar argumentos de distinción o invocación de precedentes.",
      },
      {
        id: "COMO_USAR",
        title: "¿Cómo se usa?",
        content:
          "Primero, guarde dos resoluciones en el comparador desde los resultados de búsqueda (botón 'Comparar'). Luego acceda a esta página y seleccione las dos resoluciones. Pulse 'Comparar' y espere el análisis.",
      },
      {
        id: "RESULTADOS",
        title: "¿Qué muestra el informe?",
        content:
          "El informe incluye: tabla comparativa de hechos, cuestiones jurídicas, razonamiento, doctrina citada y conclusiones. Cada dato indica su procedencia (SOURCE_FACT, INFERRED o AI_GENERATED).",
      },
      {
        id: "ESTADOS",
        title: "Estados de procedencia",
        content:
          "SOURCE_FACT: dato extraído directamente del texto de la resolución. INFERRED: dato inferido por el modelo con base en el texto. AI_GENERATED: texto generado por el modelo, verificar siempre con la fuente original.",
      },
      {
        id: "LIMITACIONES",
        title: "Limitaciones",
        content:
          "El análisis depende de la disponibilidad del texto completo de ambas resoluciones. Si solo hay resumen oficial o metadatos, el informe será menos detallado. El análisis es orientativo y no sustituye la lectura de las resoluciones originales.",
      },
    ],
    keywords: ["comparar", "comparación", "dos resoluciones", "doctrina", "precedente", "ratio decidendi"],
    related: ["search", "workspace"],
  },
  {
    id: "proposition",
    route: "/proposition",
    title: "Analizar una proposición jurídica",
    icon: "policy",
    summary: "Evalúe una tesis o argumento jurídico frente a la jurisprudencia existente del CENDOJ.",
    sections: [
      {
        id: "QUE_ES",
        title: "¿Qué es?",
        content:
          "El analizador de proposiciones jurídicas toma un argumento, tesis o afirmación legal y la contrasta automáticamente con la jurisprudencia del CENDOJ, identificando resoluciones que la apoyan, contradicen o matizan.",
      },
      {
        id: "PARA_QUE",
        title: "¿Para qué sirve?",
        content:
          "Para verificar la solidez de un argumento jurídico antes de presentarlo en un escrito, identificar jurisprudencia favorable o desfavorable, y explorar cómo los tribunales han tratado una cuestión concreta.",
      },
      {
        id: "COMO_USAR",
        title: "¿Cómo se usa?",
        content:
          "Escriba su proposición en el campo de texto. Sea específico: incluya la norma, el ámbito jurisdiccional y los hechos relevantes si es posible. Pulse 'Analizar' y revise los resultados clasificados por relación (apoya, contradistingue, neutral).",
      },
      {
        id: "RESULTADOS",
        title: "¿Qué muestra?",
        content:
          "Resoluciones clasificadas por tipo de relación: SUPPORTS (apoya), CONTRADICTS (contradistingue), DISTINGUISHES (distingue), NEUTRAL. Cada una incluye la evidencia textual y el razonamiento del análisis.",
      },
      {
        id: "LIMITACIONES",
        title: "Limitaciones",
        content:
          "La calidad del análisis depende de la precisión de la proposición formulada. Consultas vagas producirán resultados genéricos. El análisis es IA-asistido y debe verificarse con las fuentes originales.",
      },
    ],
    keywords: ["proposición", "tesis", "argumento", "verificar", "contraste", "doctrina", "apoya", "contradistingue"],
    related: ["search", "compare"],
  },
  {
    id: "workspace",
    route: "/workspace",
    title: "Espacio de trabajo",
    icon: "workspaces",
    summary: "Organice resoluciones guardadas, carpetas, etiquetas, búsquedas guardadas y análisis de noticias.",
    sections: [
      {
        id: "QUE_ES",
        title: "¿Qué es?",
        content:
          "El workspace es su biblioteca personal de investigación. Aquí se concentran todas las resoluciones guardadas, búsquedas almacenadas, análisis de noticias y documentos procesados.",
      },
      {
        id: "PARA_QUE",
        title: "¿Para qué sirve?",
        content:
          "Para organizar su investigación jurídica: agrupar resoluciones en carpetas, etiquetar por tema, añadir notas privadas, y mantener un historial de búsquedas y análisis realizados.",
      },
      {
        id: "COMO_USAR",
        title: "¿Cómo se usa?",
        content:
          "Acceda desde el icono de workspace en la barra de navegación. Use carpetas para agrupar por caso o tema. Añada etiquetas para clasificación cruzada. Cada resolución guardada admite notas privadas. Puede exportar el contenido como texto o JSON.",
      },
      {
        id: "LIMITACIONES",
        title: "Limitaciones",
        content:
          "Límite de 500 resoluciones guardadas por cuenta. Los datos se almacenan de forma segura en tu cuenta y están disponibles desde cualquier dispositivo. Puede exportar regularmente su workspace como respaldo.",
      },
      {
        id: "CONSEJOS",
        title: "Consejos",
        content:
          "Use carpetas por caso o cliente. Etiquete por tipo de cuestión jurídica. Añada notas con referencias cruzadas. Revise y limpie periódicamente resoluciones que ya no necesite.",
      },
    ],
    keywords: ["workspace", "biblioteca", "guardar", "carpetas", "etiquetas", "notas", "exportar"],
    related: ["search", "compare"],
  },
  {
    id: "alerts",
    route: "/alerts",
    title: "Alertas de jurisprudencia",
    icon: "notifications",
    summary: "Monitoree nuevas resoluciones que coincidan con sus criterios de búsqueda guardados.",
    sections: [
      {
        id: "QUE_ES",
        title: "¿Qué es?",
        content:
          "Las alertas monitorizan periódicamente el CENDOJ en busca de nuevas resoluciones que coincidan con criterios de búsqueda guardados. Recibe notificaciones cuando se publiquen resoluciones relevantes.",
      },
      {
        id: "PARA_QUE",
        title: "¿Para qué sirve?",
        content:
          "Para mantenerse al día en áreas de interés jurídico sin necesidad de buscar manualmente. Ideal para seguimiento de doctrina en evolución, vigilancia de jurisprudencia sobre temas específicos o monitoreo de casos de clientes.",
      },
      {
        id: "COMO_USAR",
        title: "¿Cómo se usa?",
        content:
          "Primero guarde una búsqueda desde la página principal. Luego cree una alerta vinculada a esa búsqueda guardada. Configure la frecuencia (diaria o semanal) y si desea recibir solo resoluciones nuevas o todas las coincidentes.",
      },
      {
        id: "ESTADOS",
        title: "Estados de alerta",
        content:
          "Activa: la alerta se ejecuta según la frecuencia configurada. Pausada: la alerta no se ejecuta pero conserva su configuración. Error: la última ejecución falló; revise los logs de ejecución.",
      },
      {
        id: "LIMITACIONES",
        title: "Limitaciones",
        content:
          "Las alertas requieren una cuenta registrada. La frecuencia mínima es diaria. Los resultados dependen de la disponibilidad de la API del CENDOJ. Las alertas no envían email de forma automática en esta versión.",
      },
    ],
    keywords: ["alertas", "notificaciones", "monitoreo", "vigilancia", "nuevas resoluciones", "seguimiento"],
    related: ["search", "workspace"],
  },
  {
    id: "news-compare",
    route: "/news-compare",
    title: "Noticia vs resolución",
    icon: "fact_check",
    summary: "Contraste el contenido de una noticia jurídica con la resolución judicial real del CENDOJ.",
    sections: [
      {
        id: "QUE_ES",
        title: "¿Qué es?",
        content:
          "La herramienta de contraste analiza una noticia jurídica (URL o texto) y la compara con la resolución judicial real del CENDOJ que se menciona o se infiere. Evalúa la precisión del titular y las afirmaciones del artículo.",
      },
      {
        id: "PARA_QUE",
        title: "¿Para qué sirve?",
        content:
          "Para verificar si una noticia jurídica refleja fielmente el contenido de la resolución. Detecta exageraciones, omisiones o errores en la cobertura mediática de sentencias y autos.",
      },
      {
        id: "COMO_USAR",
        title: "¿Cómo se usa?",
        content:
          "Pegue la URL de la noticia o su texto completo. JURELIA extrae los metadatos legales (tribunal, fecha, número de resolución), busca la resolución correspondiente en CENDOJ y genera un informe de contraste.",
      },
      {
        id: "RESULTADOS",
        title: "¿Qué muestra el informe?",
        content:
          "Evaluación del titular (respaldado, exagerado, parcial, no verificable). Cada afirmación de la noticia se clasifica como confirmada, parcialmente confirmada, no confirmada o no verificable, con evidencia textual.",
      },
      {
        id: "LIMITACIONES",
        title: "Limitaciones",
        content:
          "La extracción de contenido de noticias depende de que la URL sea accesible. Noticias tras paywall o con carga dinámica pueden no extraerse correctamente. El contraste se limita a la información disponible en CENDOJ.",
      },
    ],
    keywords: ["noticia", "contraste", "verificar", "titular", "fake news", "cobertura mediática", "fact check"],
    related: ["search", "compare"],
  },
  {
    id: "documents",
    route: "/documents",
    title: "Analizar un documento jurídico",
    icon: "description",
    summary: "Extraiga cuestiones jurídicas, argumentos y jurisprudencia relacionada de documentos PDF o Word.",
    sections: [
      {
        id: "QUE_ES",
        title: "¿Qué es?",
        content:
          "El analizador de documentos procesa escritos jurídicos (PDF, Word) para extraer automáticamente las cuestiones jurídicas, argumentos relevantes, normativa citada y jurisprudencia referenciada.",
      },
      {
        id: "PARA_QUE",
        title: "¿Para qué sirve?",
        content:
          "Para analizar rápidamente escritos largos, identificar las cuestiones jurídicas clave y encontrar jurisprudencia del CENDOJ relacionada con cada cuestión. Útil para preparación de contestaciones y recursos.",
      },
      {
        id: "COMO_USAR",
        title: "¿Cómo se usa?",
        content:
          "Suba un archivo PDF o Word. JURELIA extraerá el texto, clasificará el tipo de documento y extraerá cuestiones y argumentos. Puede entonces buscar jurisprudencia relacionada directamente desde cada cuestión extraída.",
      },
      {
        id: "RESULTADOS",
        title: "¿Qué muestra?",
        content:
          "Tipo de documento detectado, cuestiones jurídicas extraídas con nivel de confianza, argumentos principales con su ubicación en el documento, y opción de búsqueda directa de jurisprudencia por cada cuestión.",
      },
      {
        id: "LIMITACIONES",
        title: "Limitaciones",
        content:
          "Archivos de hasta 10 MB. La extracción de texto puede no ser perfecta en PDFs escaneados (OCR). El análisis es asistido por IA y los resultados deben revisarse. Documentos en catalán, euskera o gallego pueden tener precisión reducida.",
      },
      {
        id: "CONSEJOS",
        title: "Consejos",
        content:
          "Para mejores resultados, use PDFs con capa de texto (no escaneados). Revise las cuestiones extraídas antes de buscar jurisprudencia. Los niveles de confianza indican la certeza de la extracción: alto (>0.8), medio (0.5-0.8), bajo (<0.5).",
      },
    ],
    keywords: ["documento", "PDF", "Word", "escrito", "extraer", "cuestiones", "argumentos", "análisis"],
    related: ["search", "proposition"],
  },
  {
    id: "help-index",
    route: "/help",
    title: "Centro de ayuda",
    icon: "help",
    summary: "Índice completo de la ayuda de JURELIA: búsqueda, comparación, workspace, alertas, documentos y más.",
    sections: [
      {
        id: "QUE_ES",
        title: "¿Qué es?",
        content:
          "El centro de ayuda contiene toda la documentación de JURELIA organizada por tema. Incluye guías de uso, glosario de términos, preguntas frecuentes y explicación de los estados y procedencias.",
      },
      {
        id: "COMO_USAR",
        title: "¿Cómo se usa?",
        content:
          "Navegue por las categorías o use la barra de búsqueda para encontrar ayuda sobre un tema concreto. El icono ? en la esquina inferior derecha abre ayuda contextual según la página en la que se encuentre.",
      },
    ],
    keywords: ["ayuda", "help", "FAQ", "glosario", "manual"],
    related: [],
  },
];

/* ─── Categories ─── */

export const helpCategories: HelpCategory[] = [
  {
    id: "busqueda",
    label: "Búsqueda",
    icon: "search",
    entries: ["search"],
  },
  {
    id: "comparacion",
    label: "Comparación",
    icon: "compare",
    entries: ["compare", "news-compare"],
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: "workspaces",
    entries: ["workspace"],
  },
  {
    id: "alertas",
    label: "Alertas",
    icon: "notifications",
    entries: ["alerts"],
  },
  {
    id: "documentos",
    label: "Documentos",
    icon: "description",
    entries: ["documents", "proposition"],
  },
  {
    id: "ia",
    label: "IA en JURELIA",
    icon: "psychology",
    entries: ["ai-explainer"],
  },
  {
    id: "estados",
    label: "Estados y procedencia",
    icon: "verified",
    entries: ["status-glossary"],
  },
];

/* ─── Global entries (AI, Provenance, Status) ─── */

export const globalEntries: HelpEntry[] = [
  {
    id: "ai-explainer",
    route: "",
    title: "Cómo usa JURELIA la IA",
    icon: "psychology",
    summary: "Transparencia sobre el papel de la inteligencia artificial en cada herramienta.",
    sections: [
      {
        id: "QUE_ES",
        title: "¿Qué es?",
        content:
          "JURELIA utiliza modelos de lenguaje (LLM) para analizar resoluciones judiciales, comparar documentos, extraer cuestiones jurídicas y generar informes. La IA asiste, no sustituye, el juicio profesional.",
      },
      {
        id: "COMO_USAR",
        title: "¿Dónde interviene la IA?",
        content:
          "Resúmenes de resoluciones: el modelo extrae hechos, cuestiones, razonamiento y fallo. Comparación: genera el informe estructurado entre dos resoluciones. Proposiciones: evalúa la relación entre un argumento y la jurisprudencia. Documentos: extrae cuestiones y argumentos de escritos. Noticias: contrasta afirmaciones con la resolución real.",
      },
      {
        id: "LIMITACIONES",
        title: "Limitaciones de la IA",
        content:
          "Los modelos pueden cometer errores de interpretación, especialmente con terminología jurídica especializada. Todo contenido generado por IA está marcado como AI_GENERATED y debe verificarse con la fuente original. JURELIA no ofrece asesoramiento jurídico.",
      },
    ],
    keywords: ["IA", "inteligencia artificial", "LLM", "modelo", "análisis automático"],
    related: ["status-glossary"],
  },
  {
    id: "status-glossary",
    route: "",
    title: "Glosario de estados y procedencia",
    icon: "verified",
    summary: "Significado de los estados de coincidencia y niveles de procedencia de los datos.",
    sections: [
      {
        id: "ESTADOS",
        title: "Estados de coincidencia",
        content:
          "VERIFIED: coincidencia verificada mediante identificadores oficiales (ROJ/ECLI) y evidencia textual disponible.\n\nPROBABLE: coincidencia probable basada en metadatos y contexto, pero sin verificación completa de identificadores.\n\nAMBIGUOUS: múltiples candidatos posibles sin criterio claro de desambiguación.\n\nNOT_FOUND: no se encontró resolución correspondiente en CENDOJ.\n\nERROR: error técnico durante el proceso de búsqueda o verificación.",
      },
      {
        id: "PARA_QUE",
        title: "Niveles de procedencia",
        content:
          "SOURCE_FACT: información extraída directamente de la fuente oficial (texto de la resolución, metadatos del CENDOJ).\n\nINFERRED: dato inferido por el modelo a partir de la información disponible, no presente explícitamente en la fuente.\n\nAI_GENERATED: texto generado íntegramente por el modelo. Siempre debe verificarse con la fuente oficial.",
      },
      {
        id: "COMO_USAR",
        title: "Niveles de evidencia (noticias)",
        content:
          "FULL_TEXT: el contraste se realizó con el texto completo de la resolución.\n\nOFFICIAL_SUMMARY: se utilizó el resumen oficial del CENDOJ (menos detallado).\n\nMETADATA_ONLY: solo se dispuso de metadatos (ROJ, fecha, órgano). El contraste es limitado.",
      },
    ],
    keywords: ["VERIFIED", "PROBABLE", "AMBIGUOUS", "NOT_FOUND", "AI_GENERATED", "SOURCE_FACT", "INFERRED", "estado", "procedencia"],
    related: ["ai-explainer"],
  },
];

/* ─── Privacy entry ─── */

export const privacyEntry: HelpEntry = {
  id: "privacy",
  route: "",
  title: "Privacidad de documentos",
  icon: "lock",
  summary: "Cómo trata JURELIA sus documentos y datos de investigación.",
  sections: [
    {
      id: "QUE_ES",
      title: "Privacidad",
      content:
        "Los documentos que suba se procesan en el servidor y se almacenan asociados a su cuenta. Las resoluciones guardadas en su workspace se almacenan de forma segura en la base de datos y están disponibles desde cualquier dispositivo. Las búsquedas y alertas se almacenan asociadas a su cuenta para poder ejecutarlas periódicamente.",
    },
    {
      id: "LIMITACIONES",
      title: "Consideraciones",
        content:
        "JURELIA no comparte sus datos con terceros. Los textos enviados para análisis por IA se transmiten al proveedor del modelo para procesamiento. No utilice JURELIA para documentos sujetos a secreto de sumario o restricciones de acceso sin consultar previamente con su responsable de protección de datos.",
    },
  ],
  keywords: ["privacidad", "datos", "RGPD", "documento", "confidencial"],
  related: [],
};

/* ─── FAQ ─── */

export const faqItems: FAQItem[] = [
  {
    id: "faq-1",
    question: "¿JURELIA sustituye la lectura de las resoluciones originales?",
    answer:
      "No. JURELIA facilita la investigación y el análisis, pero los resúmenes e informes generados por IA deben verificarse siempre con el texto original de la resolución. No constituye asesoramiento jurídico.",
  },
  {
    id: "faq-2",
    question: "¿De dónde vienen los datos de jurisprudencia?",
    answer:
      "Toda la jurisprudencia proviene del Centro de Documentación Judicial (CENDOJ) del Consejo General del Poder Judicial de España. JURELIA consulta la API pública del CENDOJ en tiempo real.",
  },
  {
    id: "faq-3",
    question: "¿Qué significa que un resultado está marcado como AI_GENERATED?",
    answer:
      "Significa que ese contenido ha sido generado íntegramente por un modelo de lenguaje (IA). Debe tratarse como orientativo y verificarse siempre con la fuente oficial.",
  },
  {
    id: "faq-4",
    question: "¿Puedo usar JURELIA para documentos confidenciales?",
    answer:
      "Los documentos se procesan en el servidor y los textos se envían al proveedor de IA. No utilice JURELIA para documentos sujetos a secreto profesional sin evaluar los riesgos. Consulte la sección de privacidad para más detalles.",
  },
  {
    id: "faq-5",
    question: "¿Cuántas resoluciones puedo guardar en el workspace?",
    answer:
      "El límite es de 500 resoluciones por cuenta. Si alcanza el límite, deberá eliminar resoluciones existentes para añadir nuevas.",
  },
  {
    id: "faq-6",
    question: "¿Las alertas envían notificaciones por email?",
    answer:
      "En la versión actual, las alertas se ejecutan periódicamente y los resultados están disponibles en la aplicación. El envío de email no está activado en esta fase.",
  },
  {
    id: "faq-7",
    question: "¿Puedo exportar los resultados de una búsqueda o comparación?",
    answer:
      "Sí. Los informes de comparación y proposición pueden exportarse como texto plano o JSON. Las resoluciones del workspace también pueden exportarse individualmente o en bloque.",
  },
  {
    id: "faq-8",
    question: "¿Qué hago si la búsqueda no encuentra resultados?",
    answer:
      "Compruebe los filtros activos (tribunal, fecha). Pruebe con términos más generales. Use el panel de diagnóstico para ver detalles técnicos de la consulta. Si buscaba una resolución concreta, pruebe con el número ROJ directamente.",
  },
  {
    id: "faq-9",
    question: "¿JURELIA funciona con jurisprudencia de todas las jurisdicciones?",
    answer:
      "Sí. JURELIA consulta todo el catálogo del CENDOJ, que cubre las jurisdicciones civil, penal, contencioso-administrativa, social y militar, en todos los niveles jerárquicos.",
  },
  {
    id: "faq-10",
    question: "¿Qué diferencia hay entre ROJ y ECLI?",
    answer:
      "El ROJ es el identificador nacional de resoluciones judiciales en España, asignado por el CENDOJ. El ECLI (European Case Law Identifier) es el identificador europeo estandarizado. No todas las resoluciones tienen ECLI.",
  },
  {
    id: "faq-11",
    question: "¿Puedo buscar en otros idiomas oficiales (catalán, euskera, gallego)?",
    answer:
      "La búsqueda se realiza sobre la base de datos del CENDOJ, que incluye resoluciones en todos los idiomas oficiales. Sin embargo, el análisis por IA está optimizado para español y puede tener precisión reducida en otros idiomas.",
  },
  {
    id: "faq-12",
    question: "¿Cómo reporto un error o sugiero una mejora?",
    answer:
      "Utilice el formulario de contacto disponible en la aplicación o envíe un email al equipo de desarrollo. Agradecemos los reportes de errores y las sugerencias de mejora.",
  },
];

/* ─── Helpers ─── */

export function getHelpByRoute(route: string): HelpEntry | undefined {
  return helpEntries.find((e) => e.route === route);
}

export function searchHelp(query: string): HelpEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const all = [...helpEntries, ...globalEntries, privacyEntry];
  return all.filter((e) => {
    const text = [e.title, e.summary, ...e.sections.map((s) => s.content), ...e.keywords]
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).every((word) => text.includes(word));
  });
}

export function getRelatedEntries(entryId: string): HelpEntry[] {
  const all = [...helpEntries, ...globalEntries, privacyEntry];
  const entry = all.find((e) => e.id === entryId);
  if (!entry) return [];
  return entry.related
    .map((rId) => all.find((e) => e.id === rId))
    .filter(Boolean) as HelpEntry[];
}

export function getEntryById(id: string): HelpEntry | undefined {
  return [...helpEntries, ...globalEntries, privacyEntry].find((e) => e.id === id);
}