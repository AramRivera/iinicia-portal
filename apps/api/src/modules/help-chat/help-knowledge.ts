// IINICIA Portal · asistente de ayuda · help-knowledge.ts
/** El catálogo de ayuda une cada tema del portal a un destino conocido. El servicio utiliza sus identificadores para adjuntar enlaces que controla IINICIA. */
type HelpAnswer = {
  text: string;
  action: { href: string; label: string };
  sources: { href: string; label: string }[];
};

const answers = {
  platform: {
    text: 'IINICIA es el Instituto de Innovación y Ciencias Aplicadas. El portal reúne información institucional, cursos, certificaciones, registro, admisiones y contacto. Tras iniciar sesión se abre un panel según los roles de la cuenta. Moodle es el aula virtual para los cursos, actividades, evaluaciones y calificaciones. El chatbot orienta sobre el uso del portal y del campus.',
    action: { href: '/#universidad', label: 'Conocer IINICIA' },
  },
  teacher: {
    text: 'El panel de profesor muestra sus materias asignadas, sus estudiantes y el acceso a las calificaciones. El profesor abre el aula desde la materia y evalúa las entregas en el calificador de Moodle. Solo puede consultar estudiantes y cursos que tenga asignados. Si falta una materia, debe pedir que administración revise la asignación.',
    action: { href: '/dashboard/docente', label: 'Panel de profesor' },
  },
  student: {
    text: 'El estudiante consulta en su panel sus cursos, calificaciones, avance y perfil. Las actividades, recursos y entregas se realizan en el curso de Moodle, al que entra desde el portal con una matrícula confirmada. Las notas y el progreso dependen de las evaluaciones y criterios de finalización configurados en Moodle.',
    action: { href: '/dashboard/estudiante', label: 'Panel de estudiante' },
  },
  roles: {
    text: 'El portal admite roles de superadministrador, administrador, coordinador, profesor, estudiante, aspirante y soporte. Una cuenta puede tener varios roles. Coordinación trabaja dentro de sus programas asignados. Administración gestiona cuentas, postulaciones y matrículas según sus permisos. Soporte consulta diagnósticos y cuentas con acceso limitado. Un cambio de rol o de permisos debe tramitarse con administración.',
    action: { href: '/dashboard', label: 'Abrir mi panel' },
  },
  register: {
    text: 'Crea tu cuenta de aspirante y confirma el enlace que recibas por correo. Después inicia sesión para consultar la oferta y enviar tu postulación.',
    action: { href: '/registro', label: 'Crear cuenta' },
  },
  admissions: {
    text: 'En tu panel de aspirante, abre Postulación a programas, elige un programa y envía tu solicitud. Puedes consultar el dictamen en la misma sección con Actualizar estado. El portal no pide subir documentos para postularte.',
    action: { href: '/#admisiones', label: 'Ver pasos de admisión' },
  },
  enrollment: {
    text: 'La admisión asigna el programa y activa el rol Estudiante. Para acceder a un curso, además debe estar confirmada su matrícula en Moodle. Al admitir, el portal intenta matricular al estudiante en los cursos obligatorios activos del primer módulo. Los cursos optativos o de módulos posteriores se asignan por separado. En el panel de estudiante consulta Mis cursos. Si el curso aún no aparece, pide al equipo de Admisiones o Soporte que revise la matrícula.',
    action: { href: '/dashboard/estudiante', label: 'Panel de estudiante' },
  },
  email: {
    text: 'Revisa la bandeja de entrada y la carpeta de correo no deseado. Abre el enlace de confirmación del correo más reciente. Si ya confirmaste tu cuenta, puedes iniciar sesión. Si el correo no llega, usa el formulario de contacto.',
    action: { href: '/#contacto', label: 'Contactar a soporte' },
  },
  password: {
    text: 'Solicita un enlace de recuperación con el correo de tu cuenta. Abre el mensaje más reciente y sigue sus pasos en el mismo navegador donde pediste el enlace. Si no llega, revisa el correo no deseado.',
    action: { href: '/recuperar-password', label: 'Restablecer contraseña' },
  },
  verification: {
    text: 'En cada inicio de sesión el portal pide un código de seis dígitos de tu app autenticadora. Si es tu primera vez, el portal te guía para vincularla con un código QR. Si ya la vinculaste, abre la app y usa el código vigente.',
    action: { href: '/login', label: 'Ir a iniciar sesión' },
  },
  login: {
    text: 'Entra con el correo de tu cuenta. Si te registraste recientemente, confirma primero tu correo. Cuando completes la verificación en dos pasos se abrirá el panel que corresponde a tu rol.',
    action: { href: '/login', label: 'Iniciar sesión' },
  },
  courses: {
    text: 'En Cursos puedes buscar la oferta publicada por nombre o código. Si ya tienes una matrícula confirmada, encontrarás el curso en tu panel de estudiante.',
    action: { href: '/#cursos', label: 'Explorar cursos' },
  },
  certifications: {
    text: 'Consulta las certificaciones publicadas y abre la ficha de cada programa para conocer sus detalles.',
    action: { href: '/#certificaciones', label: 'Ver certificaciones' },
  },
  moodle: {
    text: 'Inicia sesión en IINICIA y abre el aula desde tu panel. Si eres estudiante y el curso todavía no aparece, verifica que tu matrícula esté confirmada. Si aparece un error al abrir el aula, informa a Soporte de Moodle desde Contacto.',
    action: { href: '/dashboard', label: 'Abrir mi panel' },
  },
  support: {
    text: 'En Contacto puedes enviar una consulta al equipo de Admisiones, Soporte de Moodle o Servicios Escolares. Describe el problema y evita incluir contraseñas o códigos de acceso.',
    action: { href: '/#contacto', label: 'Abrir Contacto' },
  },
} satisfies Record<string, Omit<HelpAnswer, 'sources'>>;

type Topic = keyof typeof answers;

// Las reglas vinculan expresiones comunes del portal a temas documentados y sus destinos internos.
const rules: [Topic, RegExp][] = [
  ['password', /\b(contrasena|password|clave|olvide|olvidado)\b/],
  ['verification', /\b(2fa|mfa|totp|autenticador[ae]?|dos pasos|codigo qr|codigo de (seis|6) digitos)\b/],
  ['email', /\b(correo|email|enlace|link)\b.*\b(confirm\w*|verific\w*|activ\w*|llega\w*|recibi\w*|vencid\w*|caduc\w*)\b|\b(confirm\w*|verific\w*|activ\w*|llega\w*|recibi\w*)\b.*\b(correo|email|cuenta|enlace)\b/],
  ['register', /\b(registro|registrarme|registrarte|me registro|crea\w* (una |mi |tu )?cuenta|abrir (una )?cuenta)\b/],
  ['admissions', /\b(admision(?:es)?|admit\w*|aspirante|postul\w*|dictamen|requisitos? de ingreso|estado de (mi |la )?solicitud|documentos?)\b/],
  ['enrollment', /\b(matricul\w*|inscripc\w*|no (veo|aparece\w*|encuentro|sale\w*)\b.*\bcursos?|cursos?\b.*\bno (aparece\w*|sale\w*))\b/],
  ['support', /\b(contact\w*|hablar con soporte|report\w* (un )?(error|problema))\b/],
  ['moodle', /\b(moodle|aula|matricul\w*|campus virtual|mis cursos)\b/],
  ['certifications', /\b(certificacion(?:es)?)\b/],
  ['courses', /\b(cursos?|catalogo|oferta academica)\b/],
  ['login', /\b(login|inici\w* (de )?sesion|entrar al portal|acceso al portal)\b/],
  ['support', /\b(soporte|mesa de ayuda)\b/],
  ['platform', /\b(iinicia|inicia|instituto|universidad|plataforma|portal)\b/],
  ['teacher', /\b(profe\w*|docente\w*|calificar|calificador|evaluar|asignatura\w*)\b/],
  ['student', /\b(estudi\w*|alumn\w*|notas?|calificacion\w*|progreso|avance|tareas?|entregas?|actividad\w*)\b/],
  ['roles', /\b(roles?|permisos?|admin\w*|superadmin\w*|coordina\w*)\b/],
];

/** Selecciona los temas de ayuda que coinciden con la pregunta para dar al asistente contexto y destinos documentados. */
export function retrieveHelpEntries(question: string) {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const matched = new Set(rules.filter(([, pattern]) => pattern.test(normalized)).map(([topic]) => topic));
  const words = normalized.split(' ').filter((word) => word.length > 3);
  const ranked = (Object.keys(answers) as Topic[]).map((id) => {
    const text = answers[id].text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const score = (matched.has(id) ? 10 : 0) + words.filter((word) => text.includes(word)).length;
    return { id, score, ...answers[id] };
  }).sort((a, b) => b.score - a.score);

  // Si el vocabulario no coincide, el modelo interpreta la consulta usando esta guía pequeña.
  // Evita rechazar saludos, faltas de ortografía y paráfrasis antes de consultar a la IA.
  return ranked[0].score >= 10 ? ranked.slice(0, 6) : ranked;
}

export const helpOutsideScope: HelpAnswer = {
  text: 'Puedo orientarte sobre el portal IINICIA. Prueba con registro, admisiones, cursos o Moodle, o envía tu consulta a Contacto.',
  action: answers.support.action,
  sources: [],
};
