import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTROLLER,
  LEGAL_MINIMUM_AGE,
  type LocalizedDoc,
} from "./types";

/**
 * Written against what the app actually does. Every claim here is checkable in
 * the code: the data listed is the data the schema stores, the processors
 * listed are the services the app talks to, and the retention rules are the
 * ones the code enforces. If the app changes, this changes with it.
 */
export const PRIVACY_DOC: LocalizedDoc = {
  es: {
    title: "Política de privacidad",
    updated: "15 de agosto de 2026",
    intro: [
      `Fantasy LDF es un juego de fútbol fantasy gratuito. Esta política explica qué datos tuyos guardamos, por qué, con quién se comparten y qué puedes hacer al respecto.`,
      `El responsable del tratamiento es ${LEGAL_CONTROLLER}. Para cualquier asunto de privacidad escribe a ${LEGAL_CONTACT_EMAIL}.`,
    ],
    sections: [
      {
        heading: "Qué datos guardamos",
        paragraphs: [
          "Solo lo necesario para que puedas tener una cuenta y jugar. No pedimos tu nombre real, tu dirección, tu teléfono ni datos de pago, porque el juego no los necesita.",
        ],
        bullets: [
          "Tu correo electrónico y tu contraseña, para que puedas entrar. La contraseña se guarda cifrada y en ningún momento la vemos. Si entras con Google, guardamos el correo que Google nos da y nunca tu contraseña de Google.",
          "Tu nombre de usuario, tu idioma y tu club favorito.",
          "Tus datos de juego: el nombre de tu equipo, tu plantilla, tus alineaciones, tus fichajes, tus puntos y las ligas privadas a las que perteneces.",
          "Tu dirección IP, solo en el momento en que haces una petición y únicamente para frenar abusos. No se guarda tal cual: se convierte en un código irreversible que no permite recuperarla, y ese código se borra al cabo de un día.",
          "Informes de error, si aceptas las cookies opcionales. Contienen el fallo técnico y la página donde ocurrió.",
        ],
      },
      {
        heading: "Para qué los usamos",
        bullets: [
          "Para darte el servicio: crear tu cuenta, guardar tu equipo, calcular tus puntos y ordenar las clasificaciones. La base es el contrato entre tú y nosotros al usar el juego.",
          "Para proteger el servicio de ataques y abusos, con límites de peticiones. La base es nuestro interés legítimo en que el juego siga en pie.",
          "Para detectar y corregir fallos, mediante informes de error. La base es tu consentimiento, y puedes retirarlo cuando quieras.",
        ],
        paragraphs: [
          "No usamos tus datos para publicidad, no hacemos perfiles con ellos y no los vendemos ni los cedemos a nadie con fines comerciales. Nunca.",
        ],
      },
      {
        heading: "Qué ven los demás",
        paragraphs: [
          "Fantasy LDF es un juego social, así que parte de lo tuyo es visible para el resto de participantes: tu nombre de usuario, el nombre de tu equipo, tus puntos, tu posición en la tabla y tu alineación una vez que cierra la jornada.",
          "Tu correo electrónico no es visible para nadie más. Solo aparece en tu propia pantalla de ajustes.",
          "Las alineaciones de una jornada que aún no ha cerrado son privadas: nadie puede verlas hasta que pasa la hora de cierre, para que nadie te copie el equipo.",
        ],
      },
      {
        heading: "Con quién se comparten",
        paragraphs: [
          "Solo con los proveedores que hacen funcionar la aplicación, y únicamente para eso. Ninguno de ellos tiene permiso para usar tus datos por su cuenta.",
        ],
        bullets: [
          "Supabase — base de datos y sistema de cuentas.",
          "Vercel — alojamiento de la aplicación.",
          "Sentry — informes de error. Solo si aceptas las cookies opcionales.",
          "Google — únicamente si eliges entrar con tu cuenta de Google.",
        ],
      },
      {
        heading: "Dónde se guardan",
        paragraphs: [
          "Los servidores de estos proveedores están fuera de la República Dominicana, principalmente en Estados Unidos. Si escribes desde el Espacio Económico Europeo, eso implica una transferencia internacional de datos; estos proveedores la amparan en las cláusulas contractuales tipo aprobadas por la Comisión Europea.",
        ],
      },
      {
        heading: "Cuánto tiempo",
        bullets: [
          "Tu cuenta y tus datos de juego: mientras la cuenta exista. Si la eliminas, se borran.",
          "Los códigos irreversibles del control de abusos: un día.",
          "Los informes de error: los conserva Sentry según su propia política, hasta 90 días.",
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          "Usamos las mínimas. Ninguna es de publicidad ni de seguimiento entre sitios, y no hay ningún rastreador de terceros en la aplicación.",
        ],
        bullets: [
          "Cookies de sesión (necesarias): te mantienen conectado. Sin ellas no podrías entrar.",
          "Cookie de idioma (necesaria): recuerda si prefieres español o inglés.",
          "Cookie de consentimiento (necesaria): recuerda qué elegiste en el aviso de cookies, para no volver a preguntarte.",
          "Informes de error (opcionales): solo se activan si los aceptas, y puedes cambiar de opinión cuando quieras.",
        ],
      },
      {
        heading: "Tus derechos",
        paragraphs: [
          "Puedes pedirnos acceso a tus datos, su corrección, su borrado, la limitación de su uso, una copia en formato portable, y oponerte a que los tratemos. Si nos diste consentimiento, puedes retirarlo en cualquier momento sin que eso afecte a lo hecho hasta entonces.",
          `Puedes borrar tu cuenta tú mismo desde Más → Eliminar mi cuenta, sin pedir permiso a nadie. Para todo lo demás escribe a ${LEGAL_CONTACT_EMAIL} y responderemos en un plazo máximo de 30 días.`,
          "Si crees que hemos manejado mal tus datos, puedes reclamar ante la autoridad de protección de datos que te corresponda.",
        ],
      },
      {
        heading: "Menores de edad",
        paragraphs: [
          `Para registrarte tienes que tener al menos ${LEGAL_MINIMUM_AGE} años. Si vives en el Espacio Económico Europeo y tienes menos de 16, necesitas que tu padre, madre o tutor autorice tu cuenta.`,
          `Si descubrimos una cuenta de alguien por debajo de la edad mínima, la eliminamos. Si eres su padre, madre o tutor y quieres que borremos una, escríbenos a ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: "Seguridad",
        paragraphs: [
          "Todo el tráfico va cifrado. Las contraseñas se guardan con funciones de hash diseñadas para eso. La base de datos aplica reglas a nivel de fila, de modo que un usuario no puede leer los datos privados de otro aunque lo intente. Aun así, ningún sistema es infalible: si alguna vez ocurre una brecha que te afecte, te lo diremos.",
        ],
      },
      {
        heading: "Cambios",
        paragraphs: [
          "Si cambiamos esta política, actualizaremos la fecha de arriba. Si el cambio es importante, lo avisaremos dentro de la aplicación antes de que entre en vigor.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy policy",
    updated: "15 August 2026",
    intro: [
      `Fantasy LDF is a free fantasy football game. This policy explains what we keep about you, why, who it is shared with, and what you can do about it.`,
      `The data controller is ${LEGAL_CONTROLLER}. For anything to do with privacy, write to ${LEGAL_CONTACT_EMAIL}.`,
    ],
    sections: [
      {
        heading: "What we keep",
        paragraphs: [
          "Only what an account and a game of fantasy football need. We don't ask for your real name, your address, your phone number or any payment details, because the game has no use for them.",
        ],
        bullets: [
          "Your email address and password, so you can sign in. The password is stored hashed and we never see it. If you sign in with Google, we keep the email address Google gives us and never your Google password.",
          "Your username, your language and your favourite club.",
          "Your game data: your team name, squad, lineups, transfers, points and the private leagues you belong to.",
          "Your IP address, only while a request is being handled and only to stop abuse. It is never stored as-is: it is turned into a one-way code it cannot be recovered from, and that code is deleted after a day.",
          "Error reports, if you accept optional cookies. They contain the technical failure and the page it happened on.",
        ],
      },
      {
        heading: "What we use it for",
        bullets: [
          "To run the service: create your account, store your team, work out your points and order the standings. The basis is the contract between you and us when you use the game.",
          "To protect the service from attacks and abuse, through rate limits. The basis is our legitimate interest in keeping the game up.",
          "To find and fix faults, through error reports. The basis is your consent, and you can withdraw it whenever you like.",
        ],
        paragraphs: [
          "We do not use your data for advertising, we do not profile you with it, and we do not sell it or hand it to anyone for commercial purposes. Not ever.",
        ],
      },
      {
        heading: "What other players can see",
        paragraphs: [
          "Fantasy LDF is a social game, so some of what is yours is visible to other players: your username, your team name, your points, your position in the table, and your lineup once the gameweek deadline has passed.",
          "Your email address is visible to nobody else. It appears only on your own settings screen.",
          "Lineups for a gameweek that hasn't closed yet are private — nobody can see them until the deadline passes, so nobody can copy your team.",
        ],
      },
      {
        heading: "Who it is shared with",
        paragraphs: [
          "Only the providers that make the app work, and only for that. None of them is allowed to use your data for their own purposes.",
        ],
        bullets: [
          "Supabase — database and accounts.",
          "Vercel — application hosting.",
          "Sentry — error reports. Only if you accept optional cookies.",
          "Google — only if you choose to sign in with your Google account.",
        ],
      },
      {
        heading: "Where it is stored",
        paragraphs: [
          "These providers' servers sit outside the Dominican Republic, mainly in the United States. If you are writing from the European Economic Area that means an international transfer; these providers cover it with the standard contractual clauses approved by the European Commission.",
        ],
      },
      {
        heading: "How long we keep it",
        bullets: [
          "Your account and game data: for as long as the account exists. Delete it and they go.",
          "The one-way codes used for abuse control: one day.",
          "Error reports: kept by Sentry under its own policy, up to 90 days.",
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          "We use as few as possible. None of them is for advertising or cross-site tracking, and there is no third-party tracker anywhere in the app.",
        ],
        bullets: [
          "Session cookies (necessary): they keep you signed in. Without them you couldn't log in at all.",
          "Language cookie (necessary): remembers whether you prefer Spanish or English.",
          "Consent cookie (necessary): remembers what you chose in the cookie notice, so we don't ask again.",
          "Error reporting (optional): only switched on if you accept it, and you can change your mind at any time.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can ask us for access to your data, for it to be corrected, deleted or restricted, for a portable copy, and you can object to us processing it. Where you gave consent, you can withdraw it at any time without affecting what was done before.",
          `You can delete your account yourself from More → Delete my account, without asking anyone. For anything else write to ${LEGAL_CONTACT_EMAIL} and we will answer within 30 days at the latest.`,
          "If you think we have handled your data badly, you can complain to your data protection authority.",
        ],
      },
      {
        heading: "Minors",
        paragraphs: [
          `You must be at least ${LEGAL_MINIMUM_AGE} to register. If you live in the European Economic Area and are under 16, a parent or guardian has to approve your account.`,
          `If we find an account belonging to someone under the minimum age, we delete it. If you are a parent or guardian and want one removed, write to ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "All traffic is encrypted. Passwords are stored with hashing functions built for the job. The database enforces row-level rules, so one user cannot read another's private data even if they try. No system is perfect, though: if a breach ever affects you, we will tell you.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "If we change this policy we will update the date above. If the change is a significant one, we will say so inside the app before it takes effect.",
        ],
      },
    ],
  },
};
