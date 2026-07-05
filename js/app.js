const cardGrid = document.querySelector("#cardGrid");
const itemCount = document.querySelector("#itemCount");

function createCard(item) {
  return `
    <article class="item-card" data-category="${item.category}" data-id="${item.id}">
      <div class="card-meta">
        <span class="badge">${item.category}</span>
        <span>#${String(item.id).padStart(2, "0")}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      <div class="card-tags">
        ${item.tags.map((tag) => `<span>${tag}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderCards(items = starterItems) {
  cardGrid.innerHTML = items.map(createCard).join("");
  itemCount.textContent = items.length;
}

renderCards();

// Students can implement selected feature cards below.
// Recommended targets:
// - .toolbar-slot: search/filter/sort controls
// - .feature-slot[data-slot="primary-feature"]: main interactive feature
// - .feature-slot[data-slot="secondary-feature"]: form/vote/saved-list area
// - .feature-slot[data-slot="status-feature"]: result/error/countdown/status display
