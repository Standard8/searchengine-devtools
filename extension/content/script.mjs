/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import ByEngineView from "./byEngineView.mjs";
import ConfigSelection from "./configSelection.mjs";
import ConfigController from "./configController.mjs";
import CompareView from "./compareView.mjs";
import EngineSuggestionsView from "./engineSuggestionsView.mjs";
import EnginesView from "./enginesView.mjs";
import EngineUrlView from "./engineUrlView.mjs";
import AllEnginesView from "./allEnginesView.mjs";

const searchengines = browser.experiments.searchengines;

const allTabs = ["by-engine", "all-engines", "by-locales", "compare-configs"];

if (!searchengines) {
  alert(
    "SearchEngine Devtools needs to be ran on nightly with prefs enabled (https://webextensions-experiments.readthedocs.io/en/latest/faq.html#why-is-my-experiment-undefined-on-beta-and-release)"
  );
}

const $ = document.querySelector.bind(document);
let lastClickedRow = null;

async function main() {
  localStorage.setItem("lastReload", Date.now());

  customElements.define("config-selection", ConfigSelection);
  customElements.define("config-controller", ConfigController);
  customElements.define("compare-view", CompareView);
  customElements.define("engines-view", EnginesView);
  customElements.define("all-engines-view", AllEnginesView);
  customElements.define("by-engine-view", ByEngineView);
  customElements.define("engine-url-view", EngineUrlView);
  customElements.define("engine-suggestions-view", EngineSuggestionsView);

  await initUI();

  let configController = $("#config-controller");
  await configController.setCompareConfigsSelected(
    $("#compare-configs").hasAttribute("selected")
  );
  try {
    await setupEnginesView();
  } catch (ex) {
    console.error(ex);
    $("config-controller").updateInvalidMessageDisplay(false);
  }
  document.body.classList.remove("loading");
}

async function initUI() {
  $("#config-controller").addEventListener("change", reloadPage);

  $("#engines-view")
    .shadowRoot.getElementById("engines-table")
    .addEventListener("click", showConfig);

  $("#engines-view")
    .shadowRoot.getElementById("engines-table")
    .addEventListener("click", displayUrls);

  $("#by-locales").setAttribute("selected", true);
  $("#by-locales-tab").setAttribute("selected", true);

  for (let tab of allTabs) {
    $("#" + tab).addEventListener("click", changeTabs);
  }
}

async function changeTabs(event) {
  event.preventDefault();
  for (const tab of allTabs) {
    if (tab == event.target.id) {
      $(`#${tab}`).setAttribute("selected", true);
      $(`#${tab}-tab`).setAttribute("selected", true);
    } else {
      $(`#${tab}`).removeAttribute("selected");
      $(`#${tab}-tab`).removeAttribute("selected");
    }
  }
  await $("#config-controller").setCompareConfigsSelected(
    $("#compare-configs").hasAttribute("selected")
  );
  $("#engine-urls-table").clear();

  await setupTabs(event.target.id);
}

async function showConfig(e) {
  if (e.target.tagName.toLowerCase() != "div") {
    return;
  }
  let id = e.target.data.identifier;
  if (!id) {
    return;
  }
  $("#config-controller").moveConfigToId(id);
}

async function displayUrls(e) {
  let clickedRow = e.target.closest("div");

  // If the clicked row is the same as the last clicked row, do nothing
  if (clickedRow === lastClickedRow) {
    return;
  }

  // Update the reference to the last clicked row
  lastClickedRow = clickedRow;

  // When a new row is clicked, remove the last table to show the new table
  // of urls for the new row
  let engineUrlsTable = $("#engine-urls-table");

  await engineUrlsTable.loadEngineUrls(e.target.data);
}

function reloadPage(event) {
  event.preventDefault();
  localStorage.setItem("lastReload", Date.now());

  (async () => {
    document.body.classList.add("loading");

    $("#by-engine-view").clear();
    let configController = $("#config-controller");
    await configController.setCompareConfigsSelected(
      $("#compare-configs").hasAttribute("selected")
    );

    let tabId = allTabs.find((t) => $(`#${t}`).getAttribute("selected"));
    await setupTabs(tabId);

    document.body.classList.remove("loading");
  })();
}

async function setupTabs(tabId) {
  try {
    switch (tabId) {
      case "compare-configs":
        await setupDiff();
        break;
      case "all-engines":
        await setupAllEnginesView();
        break;
      case "by-locales":
        await setupEnginesView();
        break;
      case "by-engine":
        await setupByEngine();
        break;
    }
    $("config-controller").updateInvalidMessageDisplay(true);
  } catch (ex) {
    console.error(ex);
    $("config-controller").updateInvalidMessageDisplay(false);
  }
}

async function setupDiff() {
  let configController = $("#config-controller");
  const oldConfig = JSON.parse(await configController.fetchPrimaryConfig());
  const newConfig = JSON.parse(await configController.fetchSecondaryConfig());
  await $("#compare-view").doDiffCalculation(oldConfig, newConfig);
}

async function setupByEngine() {
  if ($("#by-engine").hasAttribute("selected")) {
    await $("#by-engine-view").calculateLocaleRegions(
      null,
      JSON.parse(await $("#config-controller").fetchPrimaryConfig())
    );
  }
}

async function setupAllEnginesView() {
  await $("#all-engines-view").loadEngines(
    null,
    ...(await Promise.all([
      $("#config-controller").fetchPrimaryConfig(),
      $("#config-controller").getAttachmentBaseUrl(),
      $("#config-controller").fetchIconConfig(),
    ]))
  );
}

async function setupEnginesView() {
  await $("#engines-view").loadEngines(
    null,
    ...(await Promise.all([
      $("#config-controller").fetchPrimaryConfig(),
      $("#config-controller").fetchConfigOverrides(),
      $("#config-controller").getAttachmentBaseUrl(),
      $("#config-controller").fetchIconConfig(),
    ]))
  );
}

window.addEventListener("load", main, { once: true });
