import webpush from "web-push";
import { query } from "./db";
import { sendGuardianNotificationEmail } from "./email";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:sige@escola.ao";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn("[push] VAPID keys not configured. Push notifications disabled.");
}

export type NotificacaoTipo = "nota" | "falta" | "propina" | "mensagem" | "geral";

export interface GuardianNotificationPayload {
  titulo: string;
  mensagem: string;
  tipo: NotificacaoTipo;
  url?: string;
  alunoId?: string;
  alunoNome?: string;
}

type JsonObject = Record<string, unknown>;

async function getGuardianByAlunoId(alunoId: string): Promise<{ email: string | null; userId: string | null }> {
  const rows = await query<JsonObject>(
    `SELECT u.id, u.email
     FROM public.utilizadores u
     WHERE u."alunoId" = $1 AND u.role = 'encarregado' AND u.ativo = true
     LIMIT 1`,
    [alunoId]
  );
  if (!rows[0]) return { email: null, userId: null };
  return { email: rows[0].email as string, userId: rows[0].id as string };
}

async function getAlunoEmailEncarregado(alunoId: string): Promise<{ emailEncarregado: string | null; nomeAluno: string | null; nomeEncarregado: string | null }> {
  const rows = await query<JsonObject>(
    `SELECT "emailEncarregado", nome || ' ' || apelido as "nomeAluno", "nomeEncarregado"
     FROM public.alunos WHERE id = $1 LIMIT 1`,
    [alunoId]
  );
  if (!rows[0]) return { emailEncarregado: null, nomeAluno: null, nomeEncarregado: null };
  return {
    emailEncarregado: rows[0].emailEncarregado as string | null,
    nomeAluno: rows[0].nomeAluno as string | null,
    nomeEncarregado: rows[0].nomeEncarregado as string | null,
  };
}

async function getPushSubscriptionsForUser(utilizadorId: string) {
  const rows = await query<JsonObject>(
    `SELECT * FROM public.push_subscriptions WHERE "utilizadorId" = $1`,
    [utilizadorId]
  );
  return rows;
}

async function sendPushToUser(utilizadorId: string, payload: GuardianNotificationPayload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await getPushSubscriptionsForUser(utilizadorId);
  const pushPayload = JSON.stringify({
    title: payload.titulo,
    body: payload.mensagem,
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    data: { url: payload.url ?? "/", tipo: payload.tipo },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: {
              p256dh: sub.p256dh as string,
              auth: sub.auth as string,
            },
          },
          pushPayload
        );
      } catch (err: unknown) {
        const pushErr = err as { statusCode?: number };
        if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
          await query(
            `DELETE FROM public.push_subscriptions WHERE endpoint = $1`,
            [sub.endpoint]
          );
          console.log("[push] Removed expired subscription:", sub.endpoint);
        } else {
          throw err;
        }
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.warn(`[push] ${failed.length} push(es) failed for user ${utilizadorId}`);
  }
}

export async function notifyGuardianAboutNota(
  alunoId: string,
  disciplina: string,
  nf: number | null,
  trimestre: string
) {
  try {
    const aluno = await getAlunoEmailEncarregado(alunoId);
    const { userId } = await getGuardianByAlunoId(alunoId);

    const nfDisplay = nf !== null ? `${nf} valores` : "lançada";
    const payload: GuardianNotificationPayload = {
      titulo: "📋 Nova Nota Lançada",
      mensagem: `A nota de ${aluno.nomeAluno ?? "seu educando"} em ${disciplina} (${trimestre}) foi ${nfDisplay}.`,
      tipo: "nota",
      url: "/portal-encarregado",
      alunoId,
      alunoNome: aluno.nomeAluno ?? undefined,
    };

    const tasks: Promise<unknown>[] = [];

    if (userId) {
      tasks.push(sendPushToUser(userId, payload));
    }

    if (aluno.emailEncarregado) {
      tasks.push(
        sendGuardianNotificationEmail(
          aluno.emailEncarregado,
          aluno.nomeEncarregado ?? "Encarregado",
          payload.titulo,
          payload.mensagem,
          "nota",
          aluno.nomeAluno ?? undefined
        )
      );
    }

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error("[notify] Error notifying guardian about nota:", err);
  }
}

export async function notifyGuardianAboutFalta(
  alunoId: string,
  disciplina: string,
  data: string,
  status: string
) {
  if (status !== "falta") return;

  try {
    const aluno = await getAlunoEmailEncarregado(alunoId);
    const { userId } = await getGuardianByAlunoId(alunoId);

    const payload: GuardianNotificationPayload = {
      titulo: "⚠️ Falta Registada",
      mensagem: `${aluno.nomeAluno ?? "Seu educando"} teve falta em ${disciplina} no dia ${data}.`,
      tipo: "falta",
      url: "/portal-encarregado",
      alunoId,
      alunoNome: aluno.nomeAluno ?? undefined,
    };

    const tasks: Promise<unknown>[] = [];

    if (userId) {
      tasks.push(sendPushToUser(userId, payload));
    }

    if (aluno.emailEncarregado) {
      tasks.push(
        sendGuardianNotificationEmail(
          aluno.emailEncarregado,
          aluno.nomeEncarregado ?? "Encarregado",
          payload.titulo,
          payload.mensagem,
          "falta",
          aluno.nomeAluno ?? undefined
        )
      );
    }

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error("[notify] Error notifying guardian about falta:", err);
  }
}

export async function notifyGuardianAboutPropina(
  alunoId: string,
  mes: string,
  valor: number,
  status: string
) {
  try {
    const aluno = await getAlunoEmailEncarregado(alunoId);
    const { userId } = await getGuardianByAlunoId(alunoId);

    const isPendente = status === "pendente" || status === "em_atraso";
    const titulo = isPendente ? "💳 Propina em Atraso" : "✅ Pagamento Confirmado";
    const mensagem = isPendente
      ? `A propina de ${aluno.nomeAluno ?? "seu educando"} referente a ${mes} (${valor.toLocaleString("pt-AO")} Kz) está pendente.`
      : `O pagamento de ${aluno.nomeAluno ?? "seu educando"} referente a ${mes} foi confirmado com sucesso.`;

    const payload: GuardianNotificationPayload = {
      titulo,
      mensagem,
      tipo: "propina",
      url: "/portal-encarregado",
      alunoId,
      alunoNome: aluno.nomeAluno ?? undefined,
    };

    const tasks: Promise<unknown>[] = [];

    if (userId) {
      tasks.push(sendPushToUser(userId, payload));
    }

    if (aluno.emailEncarregado) {
      tasks.push(
        sendGuardianNotificationEmail(
          aluno.emailEncarregado,
          aluno.nomeEncarregado ?? "Encarregado",
          payload.titulo,
          payload.mensagem,
          "propina",
          aluno.nomeAluno ?? undefined
        )
      );
    }

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error("[notify] Error notifying guardian about propina:", err);
  }
}

export async function notifyGuardianGeneric(
  alunoId: string,
  titulo: string,
  mensagem: string
) {
  try {
    const aluno = await getAlunoEmailEncarregado(alunoId);
    const { userId } = await getGuardianByAlunoId(alunoId);

    const payload: GuardianNotificationPayload = {
      titulo,
      mensagem,
      tipo: "geral",
      url: "/portal-encarregado",
    };

    const tasks: Promise<unknown>[] = [];

    if (userId) {
      tasks.push(sendPushToUser(userId, payload));
    }

    if (aluno.emailEncarregado) {
      tasks.push(
        sendGuardianNotificationEmail(
          aluno.emailEncarregado,
          aluno.nomeEncarregado ?? "Encarregado",
          titulo,
          mensagem,
          "geral",
          aluno.nomeAluno ?? undefined
        )
      );
    }

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error("[notify] Error sending generic guardian notification:", err);
  }
}
