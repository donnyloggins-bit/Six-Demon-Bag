import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const listEl = document.getElementById("list");
const emptyStateEl = document.getElementById("empty-state");
const syncBanner = document.getElementById("sync-banner");

const dialog = document.getElementById("ticket-dialog");
const form = document.getElementById("ticket-form");
const dialogTitle = document.getElementById("dialog-title");
const newTicketBtn = document.getElementById("new-ticket-btn");
const cancelBtn = document.getElementById("cancel-btn");
const deleteBtn = document.getElementById("delete-btn");

const fields = {
  customerName: document.getElementById("f-customer-name"),
  hangerTag: document.getElementById("f-hanger-tag"),
  store: document.getElementById("f-store"),
  salesperson: document.getElementById("f-salesperson"),
  fitter: document.getElementById("f-fitter"),
  dateSold: document.getElementById("f-date-sold"),
  dateDue: document.getElementById("f-date-due"),
  items: [
    document.getElementById("f-item-1"),
    document.getElementById("f-item-2"),
    document.getElementById("f-item-3"),
    document.getElementById("f-item-4"),
  ],
};

let tickets = [];
let editingId = null;

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso) {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dueDescriptor(dateDue) {
  const due = parseDate(dateDue);
  if (!due) return { label: "No due date", cls: "ok" };
  const today = todayISO();
  const msPerDay = 86400000;
  const diffDays = Math.round((due - today) / msPerDay);
  if (diffDays < 0) {
    return { label: `Overdue ${Math.abs(diffDays)}d`, cls: "overdue" };
  }
  if (diffDays === 0) return { label: "Due today", cls: "overdue" };
  if (diffDays <= 2) return { label: `Due in ${diffDays}d`, cls: "soon" };
  return { label: `Due ${formatDate(dateDue)}`, cls: "ok" };
}

function render() {
  listEl.innerHTML = "";

  const due = tickets
    .filter((t) => !t.completed && !t.picked_up)
    .sort((a, b) => (a.date_due || "9999").localeCompare(b.date_due || "9999"));
  const ready = tickets
    .filter((t) => t.completed && !t.picked_up)
    .sort((a, b) => (a.completed_at || "").localeCompare(b.completed_at || ""));
  const done = tickets
    .filter((t) => t.picked_up)
    .sort((a, b) => (b.date_due || "").localeCompare(a.date_due || ""));

  emptyStateEl.hidden = tickets.length > 0;

  due.forEach((t) => listEl.appendChild(renderCard(t)));

  if (ready.length) {
    listEl.appendChild(sectionHeading("Ready for Pickup"));
    ready.forEach((t) => listEl.appendChild(renderCard(t)));
  }

  if (done.length) {
    listEl.appendChild(sectionHeading("Picked Up"));
    done.forEach((t) => listEl.appendChild(renderCard(t)));
  }
}

function sectionHeading(text) {
  const heading = document.createElement("div");
  heading.className = "section-heading";
  heading.textContent = text;
  return heading;
}

function renderCard(t) {
  const card = document.createElement("article");
  const descriptor = t.picked_up
    ? { label: "Picked up", cls: "done" }
    : t.completed
    ? { label: "Ready for pickup", cls: "ready" }
    : dueDescriptor(t.date_due);
  card.className = `card card--${descriptor.cls}`;

  const items = [t.item_1, t.item_2, t.item_3, t.item_4].filter(Boolean);

  card.innerHTML = `
    <div class="card__top">
      <span class="card__name"></span>
      <span class="card__due"></span>
    </div>
    <div class="card__meta">
      <span>Tag #${escapeHtml(t.hanger_tag_number)}</span>
      <span>${escapeHtml(t.destination_store)}</span>
      <span>Sold ${formatDate(t.date_sold)}</span>
      ${t.salesperson ? `<span>Sold by ${escapeHtml(t.salesperson)}</span>` : ""}
      ${t.fitter ? `<span>Fit by ${escapeHtml(t.fitter)}</span>` : ""}
    </div>
    ${items.length ? `<div class="card__items">${items.map((i) => `<span class="item-chip"></span>`).join("")}</div>` : ""}
    <div class="card__toggles">
      <label class="card__toggle">
        <input type="checkbox" class="js-completed" ${t.completed ? "checked" : ""} />
        Completed
      </label>
      <label class="card__toggle">
        <input type="checkbox" class="js-picked-up" ${t.picked_up ? "checked" : ""} />
        Picked up
      </label>
    </div>
  `;

  card.querySelector(".card__name").textContent = t.customer_name;
  card.querySelector(".card__due").textContent = descriptor.label;
  const chips = card.querySelectorAll(".item-chip");
  chips.forEach((chip, i) => (chip.textContent = items[i]));

  const completedCheckbox = card.querySelector(".js-completed");
  completedCheckbox.addEventListener("click", (e) => e.stopPropagation());
  completedCheckbox.addEventListener("change", async (e) => {
    await toggleField(t.id, "completed", e.target.checked);
  });

  const pickedUpCheckbox = card.querySelector(".js-picked-up");
  pickedUpCheckbox.addEventListener("click", (e) => e.stopPropagation());
  pickedUpCheckbox.addEventListener("change", async (e) => {
    await toggleField(t.id, "picked_up", e.target.checked);
  });

  card.addEventListener("click", () => openDialog(t));

  return card;
}

function escapeHtml(str) {
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function openDialog(ticket) {
  editingId = ticket ? ticket.id : null;
  dialogTitle.textContent = ticket ? "Edit Ticket" : "New Ticket";
  deleteBtn.hidden = !ticket;

  fields.customerName.value = ticket?.customer_name ?? "";
  fields.hangerTag.value = ticket?.hanger_tag_number ?? "";
  fields.store.value = ticket?.destination_store ?? "";
  fields.salesperson.value = ticket?.salesperson ?? "";
  fields.fitter.value = ticket?.fitter ?? "";
  fields.dateSold.value = ticket?.date_sold ?? "";
  fields.dateDue.value = ticket?.date_due ?? "";
  fields.items[0].value = ticket?.item_1 ?? "";
  fields.items[1].value = ticket?.item_2 ?? "";
  fields.items[2].value = ticket?.item_3 ?? "";
  fields.items[3].value = ticket?.item_4 ?? "";

  dialog.showModal();
}

function closeDialog() {
  dialog.close();
  editingId = null;
  form.reset();
}

newTicketBtn.addEventListener("click", () => openDialog(null));
cancelBtn.addEventListener("click", closeDialog);

dialog.addEventListener("cancel", () => {
  editingId = null;
  form.reset();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!form.reportValidity()) return;

  const payload = {
    customer_name: fields.customerName.value.trim(),
    hanger_tag_number: fields.hangerTag.value.trim(),
    destination_store: fields.store.value,
    salesperson: fields.salesperson.value.trim() || null,
    fitter: fields.fitter.value.trim() || null,
    date_sold: fields.dateSold.value || null,
    date_due: fields.dateDue.value || null,
    item_1: fields.items[0].value.trim() || null,
    item_2: fields.items[1].value.trim() || null,
    item_3: fields.items[2].value.trim() || null,
    item_4: fields.items[3].value.trim() || null,
  };

  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;
  try {
    if (editingId) {
      const { error } = await supabase.from("alterations").update(payload).eq("id", editingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("alterations").insert(payload);
      if (error) throw error;
    }
    closeDialog();
  } catch (err) {
    alert(`Could not save ticket: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
  }
});

deleteBtn.addEventListener("click", async () => {
  if (!editingId) return;
  if (!confirm("Delete this ticket? This cannot be undone.")) return;
  const { error } = await supabase.from("alterations").delete().eq("id", editingId);
  if (error) {
    alert(`Could not delete ticket: ${error.message}`);
    return;
  }
  closeDialog();
});

async function toggleField(id, field, value) {
  const { error } = await supabase.from("alterations").update({ [field]: value }).eq("id", id);
  if (error) alert(`Could not update ticket: ${error.message}`);
}

async function loadTickets() {
  const { data, error } = await supabase.from("alterations").select("*");
  if (error) {
    syncBanner.hidden = false;
    syncBanner.textContent = `Could not load tickets: ${error.message}`;
    return;
  }
  syncBanner.hidden = true;
  tickets = data ?? [];
  render();
}

function upsertLocal(row) {
  const idx = tickets.findIndex((t) => t.id === row.id);
  if (idx >= 0) tickets[idx] = row;
  else tickets.push(row);
}

function removeLocal(id) {
  tickets = tickets.filter((t) => t.id !== id);
}

supabase
  .channel("alterations-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "alterations" }, (payload) => {
    if (payload.eventType === "DELETE") {
      removeLocal(payload.old.id);
    } else {
      upsertLocal(payload.new);
    }
    render();
  })
  .subscribe((status) => {
    if (status === "SUBSCRIBED") {
      syncBanner.hidden = true;
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      syncBanner.hidden = false;
      syncBanner.textContent = "Connection lost — reconnecting…";
    }
  });

loadTickets();
