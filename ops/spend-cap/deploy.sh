#!/usr/bin/env bash
# Creates or updates the robisit-tts spend cap: Pub/Sub topic, budget and the
# function that disables Text-to-Speech when the budget is reached. Safe to
# re-run. Needs gcloud logged in as a project owner and billing admin.
set -euo pipefail
cd "$(dirname "$0")"
P=robisit-tts
BA=018E12-02BB13-05C1A2
AMOUNT=50CAD
SA=spend-cap@$P.iam.gserviceaccount.com

gcloud pubsub topics describe budget-cap --project $P >/dev/null 2>&1 || gcloud pubsub topics create budget-cap --project $P
gcloud iam service-accounts describe $SA --project $P >/dev/null 2>&1 || \
  gcloud iam service-accounts create spend-cap --project $P --display-name "Spend cap (disables Text-to-Speech at budget)" 2>&1 \
  | grep -v "already exists" || true
# A new service account can take a few seconds to become visible to IAM.
for i in 1 2 3 4 5 6; do
  gcloud projects add-iam-policy-binding $P --member "serviceAccount:$SA" --role roles/serviceusage.serviceUsageAdmin \
    --condition=None --format=none && break
  [ $i = 6 ] && exit 1; sleep 10
done

gcloud functions deploy spend-cap --gen2 --project $P --region us-central1 --runtime nodejs22 \
  --source . --entry-point capSpend --trigger-topic budget-cap \
  --service-account $SA --trigger-service-account $SA \
  --max-instances 1 --memory 256Mi --quiet
# Eventarc delivers Pub/Sub messages as the trigger account, which must be allowed to invoke.
gcloud run services add-iam-policy-binding spend-cap --project $P --region us-central1 \
  --member "serviceAccount:$SA" --role roles/run.invoker --format=none

if ! gcloud billing budgets list --billing-account $BA --format="value(displayName)" | grep -qx "robisit-tts spend cap"; then
  gcloud billing budgets create --billing-account $BA --display-name "robisit-tts spend cap" \
    --budget-amount $AMOUNT --filter-projects projects/$P \
    --threshold-rule percent=0.5 --threshold-rule percent=0.9 --threshold-rule percent=1.0 \
    --notifications-rule-pubsub-topic projects/$P/topics/budget-cap
fi
