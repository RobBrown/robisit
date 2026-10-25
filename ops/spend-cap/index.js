/* Spend cap for the robisit-tts Google Cloud project.
 *
 * Cloud Billing budgets only alert; they never stop spending. The budget
 * "robisit-tts spend cap" (50 CAD) publishes its status to the Pub/Sub topic
 * `budget-cap` several times a day. This function receives each message and,
 * once actual cost reaches the budget, disables the Text-to-Speech API on the
 * project. Narration generation then fails safely (cards publish without a
 * Play button); audio already on robisit.com keeps playing, since it's static.
 *
 * Re-enable after review:
 *   gcloud services enable texttospeech.googleapis.com --project robisit-tts
 *
 * Deployed with ops/spend-cap/deploy.sh. Runs as spend-cap@robisit-tts, whose
 * only role is Service Usage Admin on this project.
 */
'use strict';

const functions = require('@google-cloud/functions-framework');
const { GoogleAuth } = require('google-auth-library');

const PROJECT = process.env.CAP_PROJECT || 'robisit-tts';
const SERVICE = 'texttospeech.googleapis.com';
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

// Decision only, so it can be tested without Google: stop at or above the budget.
function overBudget(n) {
  return typeof n.costAmount === 'number' && typeof n.budgetAmount === 'number' && n.costAmount >= n.budgetAmount;
}

functions.cloudEvent('capSpend', async (event) => {
  const n = JSON.parse(Buffer.from(event.data.message.data, 'base64').toString('utf8'));
  console.log(`budget "${n.budgetDisplayName}": ${n.costAmount} of ${n.budgetAmount} ${n.currencyCode}`);
  if (!overBudget(n)) return;

  const client = await auth.getClient();
  const name = `projects/${PROJECT}/services/${SERVICE}`;
  const { data } = await client.request({ url: `https://serviceusage.googleapis.com/v1/${name}` });
  if (data.state === 'DISABLED') { console.log(`${SERVICE} already disabled`); return; }
  await client.request({ url: `https://serviceusage.googleapis.com/v1/${name}:disable`, method: 'POST', data: {} });
  console.warn(`SPEND CAP REACHED: disabled ${SERVICE} on ${PROJECT} at ${n.costAmount} ${n.currencyCode}`);
});

module.exports = { overBudget };
