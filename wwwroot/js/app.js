// api endpoint
var API = '/api/tasks';

// profile info - just saved in localStorage, no need for a server table for this
var PK = 'mp_profile';
var prof = { av: '🌸', name: '', email: '' };

try {
  var _p = localStorage.getItem(PK);
  if (_p) prof = JSON.parse(_p);
} catch (e) {}

function saveP() {
  try {
    localStorage.setItem(PK, JSON.stringify(prof));
  } catch (e) {}
}

// app state
var view = 'day';
var cur = new Date();
var sf = null;
var selAv = '🌸';
var allTasks = []; // cached list from server, we filter this on the client
var PI = { High: '🔥', Medium: '🌤️', Low: '🌿' };

// switch between login / profile setup / main app screens
function show(id) {
  ['pgLogin', 'pgProfile', 'pgApp'].forEach(function (s) {
    document.getElementById(s).style.display = 'none';
  });
  var el = document.getElementById(id);
  el.style.display = id === 'pgApp' ? 'block' : 'flex';
}

// ---- login / profile setup ----

function doLogin() {
  var u = document.getElementById('lUser').value.trim();
  var p = document.getElementById('lPass').value.trim();

  if (!u || !p) {
    document.getElementById('lerr').style.display = 'block';
    return;
  }
  document.getElementById('lerr').style.display = 'none';

  if (!prof.name) {
    show('pgProfile');
  } else {
    show('pgApp');
    updatePUI();
    fetchAndRender();
  }
}

document.getElementById('lUser').onkeydown = function (e) {
  if (e.key === 'Enter') doLogin();
};
document.getElementById('lPass').onkeydown = function (e) {
  if (e.key === 'Enter') doLogin();
};

function pickAv(el) {
  document.querySelectorAll('.avopt').forEach(function (x) {
    x.classList.remove('sel');
  });
  el.classList.add('sel');
  selAv = el.dataset.av;
}

function doProfile() {
  var name = document.getElementById('pName').value.trim() || 'Friend';
  prof = {
    av: selAv,
    name: name,
    email: document.getElementById('pEmail').value.trim()
  };
  saveP();
  show('pgApp');
  updatePUI();
  updateLabel();
  fetchAndRender();
}

function doLogout() {
  if (!confirm('Log out?')) return;
  prof = { av: '🌸', name: '', email: '' };
  try {
    localStorage.removeItem('mp_profile');
  } catch (e) {}
  closePM();
  show('pgLogin');
}

// ---- date helpers ----
// everything here uses plain YYYY-MM-DD strings so we don't have to
// deal with timezone weirdness when comparing dates

function ds(d) {
  var p = function (n) {
    return String(n).padStart(2, '0');
  };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function today() {
  return ds(new Date());
}

function fmtD(s) {
  return new Date(s + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getRange() {
  var d = new Date(cur);
  var f, t;

  if (view === 'day') {
    f = t = ds(d);
  } else if (view === 'week') {
    var s = new Date(d);
    s.setDate(d.getDate() - d.getDay());
    var e = new Date(s);
    e.setDate(s.getDate() + 6);
    f = ds(s);
    t = ds(e);
  } else if (view === 'month') {
    f = ds(new Date(d.getFullYear(), d.getMonth(), 1));
    t = ds(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  } else if (view === 'year') {
    f = d.getFullYear() + '-01-01';
    t = d.getFullYear() + '-12-31';
  } else {
    return null;
  }

  return { from: f, to: t };
}

function updateLabel() {
  var el = document.getElementById('dlabel');
  var ri = document.getElementById('rinfo');

  if (view === 'all') {
    el.textContent = 'All tasks';
    ri.innerHTML = 'Showing <b>every task</b> regardless of date';
    return;
  }

  var r = getRange();
  var sh = { month: 'short', day: 'numeric' };

  if (view === 'day') {
    el.textContent = fmtD(r.from);
    ri.innerHTML = 'Tasks with end date on <b>' + fmtD(r.from) + '</b>';
  } else if (view === 'week') {
    var a = new Date(r.from + 'T12:00:00');
    var b = new Date(r.to + 'T12:00:00');
    el.textContent = a.toLocaleDateString(undefined, sh) + ' – ' + b.toLocaleDateString(undefined, sh);
    ri.innerHTML = 'Tasks from <b>' + fmtD(r.from) + '</b> to <b>' + fmtD(r.to) + '</b>';
  } else if (view === 'month') {
    el.textContent = cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    ri.innerHTML = 'Tasks in <b>' + cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + '</b>';
  } else if (view === 'year') {
    el.textContent = cur.getFullYear();
    ri.innerHTML = 'Tasks in <b>' + cur.getFullYear() + '</b>';
  }
}

// ---- view / chip controls ----

function setView(el) {
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.remove('on');
  });
  el.classList.add('on');

  document.querySelectorAll('.chip').forEach(function (c) {
    c.classList.remove('onC', 'onM');
  });

  sf = null;
  view = el.dataset.v;
  cur = new Date();

  updateLabel();
  render();
}

function toggleChip(type) {
  var c = document.getElementById('cChip');
  var m = document.getElementById('mChip');
  var wasOn = (type === 'completed' && c.classList.contains('onC')) || (type === 'missed' && m.classList.contains('onM'));

  c.classList.remove('onC');
  m.classList.remove('onM');
  sf = wasOn ? null : type;

  if (!wasOn) {
    if (type === 'completed') c.classList.add('onC');
    else m.classList.add('onM');
  }

  render();
}

function shift(d) {
  var dt = new Date(cur);
  if (view === 'day') dt.setDate(dt.getDate() + d);
  else if (view === 'week') dt.setDate(dt.getDate() + d * 7);
  else if (view === 'month') dt.setMonth(dt.getMonth() + d);
  else if (view === 'year') dt.setFullYear(dt.getFullYear() + d);
  cur = dt;
  updateLabel();
  render();
}

function toggleSearch() {
  var s = document.getElementById('searchRow');
  s.style.display = s.style.display === 'none' ? 'block' : 'none';
  if (s.style.display === 'block') document.getElementById('searchInput').focus();
}

// ---- api calls ----

function fetchAndRender() {
  updateLabel();

  var url = API;
  var q = document.getElementById('searchInput').value.trim();
  if (q) url += '?search=' + encodeURIComponent(q);

  fetch(url)
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      allTasks = flatten(data);
      hideErr();
      render();
      fillParent();
    })
    .catch(function (e) {
      showErr('Could not reach the server. Is it running? (' + e.message + ')');
    });
}

// flattens the nested task tree into one array - needed for the
// completed / missed chip views which show tasks from any level
function flatten(tasks) {
  var result = [];
  tasks.forEach(function (t) {
    result.push(t);
    if (t.children && t.children.length) {
      flatten(t.children).forEach(function (c) {
        result.push(c);
      });
    }
  });
  return result;
}

function getTopLevel(tasks) {
  return tasks.filter(function (t) {
    return !t.parentId;
  });
}

// ---- filtering ----
// note: endDate is a plain "YYYY-MM-DD" string, so we can just
// compare strings directly and don't need to worry about timezones

function render() {
  var td = today();
  var el = document.getElementById('taskList');
  el.innerHTML = '';

  var list, mode;

  if (sf === 'completed') {
    // any completed task, at any nesting level
    list = allTasks.filter(function (t) {
      return t.isCompleted === true;
    });
    mode = 'flat';
  } else if (sf === 'missed') {
    // overdue = has a past date and isn't done yet
    list = allTasks.filter(function (t) {
      return !t.isCompleted && t.endDate && t.endDate < td;
    });
    mode = 'flat';
  } else {
    // normal date-tab view, top level tasks only
    list = getTopLevel(allTasks);
    var r = getRange();
    if (r) {
      list = list.filter(function (t) {
        if (!t.endDate) return false; // tasks without a date only show up in "All"
        return t.endDate >= r.from && t.endDate <= r.to;
      });
    }
    mode = 'nested';
  }

  if (!list.length) {
    var msg =
      sf === 'completed'
        ? 'Nothing completed yet 💪'
        : sf === 'missed'
        ? 'Nothing missed — all caught up! 🎉'
        : 'Nothing here. Tap + to add a task!';
    el.innerHTML = '<div class="empty"><span>🌷</span>' + msg + '</div>';
    return;
  }

  if (mode === 'flat') {
    list.forEach(function (t) {
      el.appendChild(buildFlat(t));
    });
  } else {
    list.forEach(function (t) {
      el.appendChild(buildNested(t, 0));
    });
  }
}

// ---- rendering ----

function getCtx(t) {
  var parts = [];
  var cur2 = t;
  while (cur2.parentId) {
    var p = allTasks.find(function (x) {
      return x.id === cur2.parentId;
    });
    if (!p) break;
    parts.unshift(p.description);
    cur2 = p;
  }
  return parts.join(' › ');
}

function buildFlat(t) {
  var div = document.createElement('div');
  div.className = 'card' + (t.isCompleted ? ' done' : '');

  var due = t.endDate ? fmtD(t.endDate) : '';
  var ctx = getCtx(t);

  div.innerHTML =
    '<div class="ck' + (t.isCompleted ? ' on' : '') + '" onclick="toggleDone(' + t.id + ')">' + (t.isCompleted ? '✓' : '') + '</div>' +
    '<div class="picon">' + (PI[t.priority] || '🌤️') + '</div>' +
    '<div class="tbody">' +
      (ctx ? '<div class="pctx"><i class="fa-solid fa-sitemap"></i> ' + esc(ctx) + '</div>' : '') +
      '<div class="ttl">' + esc(t.description) + '</div>' +
      '<div class="meta">' + (due ? '<span><i class="fa-regular fa-calendar"></i> ' + due + '</span>' : '') + '</div>' +
      (t.note ? '<div class="tnote">💭 ' + esc(t.note) + '</div>' : '') +
      (t.fileName && t.filePath ? '<div class="flink"><i class="fa-solid fa-paperclip"></i> <a href="' + t.filePath + '" target="_blank">' + esc(t.fileName) + '</a></div>' : '') +
      (t.isCompleted ? '<div class="dbadge">✓ Done</div>' : '') +
    '</div>' +
    '<div class="acts">' +
      '<button onclick="openModal(' + t.id + ')" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
      '<button onclick="delTask(' + t.id + ')" title="Delete"><i class="fa-solid fa-trash"></i></button>' +
    '</div>';

  return div;
}

function buildNested(t, depth) {
  var div = document.createElement('div');
  div.className = 'card' + (t.isCompleted ? ' done' : '');

  var due = t.endDate ? fmtD(t.endDate) : '';
  var td = today();
  var missed = !t.isCompleted && t.endDate && t.endDate < td;
  var nodate = !t.endDate && depth === 0;

  div.innerHTML =
    '<div class="ck' + (t.isCompleted ? ' on' : '') + '" onclick="toggleDone(' + t.id + ')">' + (t.isCompleted ? '✓' : '') + '</div>' +
    '<div class="picon">' + (PI[t.priority] || '🌤️') + '</div>' +
    '<div class="tbody">' +
      '<div class="ttl">' + esc(t.description) + '</div>' +
      '<div class="meta">' +
        (due ? '<span><i class="fa-regular fa-calendar"></i> ' + due + '</span>' : '') +
        (nodate ? '<span class="nodate">⚠️ No date</span>' : '') +
        (missed ? '<span class="miss"><i class="fa-solid fa-triangle-exclamation"></i> Missed</span>' : '') +
      '</div>' +
      (t.note ? '<div class="tnote">💭 ' + esc(t.note) + '</div>' : '') +
      (t.fileName && t.filePath ? '<div class="flink"><i class="fa-solid fa-paperclip"></i> <a href="' + t.filePath + '" target="_blank">' + esc(t.fileName) + '</a></div>' : '') +
      (t.isCompleted ? '<div class="dbadge">✓ Done</div>' : '') +
    '</div>' +
    '<div class="acts">' +
      (depth < 2 ? '<button onclick="openModal(null,' + t.id + ')" title="Add subtask"><i class="fa-solid fa-list-ul"></i></button>' : '') +
      '<button onclick="openModal(' + t.id + ')" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
      '<button onclick="delTask(' + t.id + ')" title="Delete"><i class="fa-solid fa-trash"></i></button>' +
    '</div>';

  // render children underneath
  if (t.children && t.children.length) {
    var sub = document.createElement('div');
    sub.className = 'subs';
    t.children.forEach(function (k) {
      sub.appendChild(buildNested(k, depth + 1));
    });
    div.querySelector('.tbody').appendChild(sub);
  }

  return div;
}

// ---- task actions ----

function toggleDone(id) {
  var t = allTasks.find(function (x) {
    return x.id === id;
  });
  if (!t) return;

  var newVal = !t.isCompleted;

  fetch(API + '/' + id + '/complete', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newVal)
  })
    .then(function () {
      fetchAndRender();
    })
    .catch(showErr);
}

function delTask(id) {
  if (!confirm('Delete this task and its subtasks?')) return;

  fetch(API + '/' + id, { method: 'DELETE' })
    .then(function () {
      fetchAndRender();
    })
    .catch(showErr);
}

// ---- modal ----

function openModal(id, pid) {
  document.getElementById('fId').value = '';
  document.getElementById('fDesc').value = '';
  document.getElementById('fNote').value = '';
  document.getElementById('fDate').value = '';
  document.getElementById('fFile').value = '';
  document.getElementById('fDone').checked = false;
  document.getElementById('fExFile').style.display = 'none';
  document.getElementById('dwarn').style.display = 'block';
  document.getElementById('fParent').value = '';
  document.getElementById('mTitle').textContent = id ? 'Edit Task ✏️' : 'New Task ✏️';

  setPriByVal('Medium');
  fillParent();
  if (pid) document.getElementById('fParent').value = pid;

  if (id) {
    fetch(API + '/' + id)
      .then(function (r) {
        return r.json();
      })
      .then(function (t) {
        document.getElementById('fId').value = t.id;
        document.getElementById('fDesc').value = t.description;
        document.getElementById('fNote').value = t.note || '';
        document.getElementById('fDate').value = t.endDate || '';
        document.getElementById('fDone').checked = !!t.isCompleted;
        document.getElementById('fParent').value = t.parentId || '';
        setPriByVal(t.priority || 'Medium');

        if (t.endDate) document.getElementById('dwarn').style.display = 'none';

        if (t.fileName && t.filePath) {
          document.getElementById('fExNm').textContent = t.fileName;
          document.getElementById('fExLink').href = t.filePath;
          document.getElementById('fExFile').style.display = 'block';
        }

        document.getElementById('overlay').classList.remove('h');
      })
      .catch(showErr);
  } else {
    document.getElementById('overlay').classList.remove('h');
  }
}

function closeModal() {
  document.getElementById('overlay').classList.add('h');
}

function onDateChange() {
  var v = document.getElementById('fDate').value;
  document.getElementById('dwarn').style.display = v ? 'none' : 'block';
}

function setPri(el) {
  document.querySelectorAll('.ppick button').forEach(function (b) {
    b.className = '';
  });
  el.className = 's' + el.dataset.p[0].toUpperCase();
  document.getElementById('fPri').value = el.dataset.p;
}

function setPriByVal(p) {
  document.querySelectorAll('.ppick button').forEach(function (b) {
    b.className = b.dataset.p === p ? 's' + p[0].toUpperCase() : '';
  });
  document.getElementById('fPri').value = p;
}

function fillParent() {
  var sel = document.getElementById('fParent');
  var cv = sel.value;

  while (sel.options.length > 1) sel.remove(1);

  // top level tasks first
  allTasks
    .filter(function (t) {
      return !t.parentId;
    })
    .forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.description.substring(0, 40);
      sel.appendChild(o);
    });

  // then subtasks that are one level deep
  allTasks
    .filter(function (t) {
      return t.parentId && allTasks.find(function (p) {
        return p.id === t.parentId && !p.parentId;
      });
    })
    .forEach(function (t) {
      var par = allTasks.find(function (p) {
        return p.id === t.parentId;
      });
      var o = document.createElement('option');
      o.value = t.id;
      o.textContent = '↳ ' + t.description.substring(0, 32) + (par ? ' (' + par.description.substring(0, 15) + ')' : '');
      sel.appendChild(o);
    });

  sel.value = cv;
}

function addParent() {
  var title = prompt('Title for the new parent task:');
  if (!title || !title.trim()) return;

  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: title.trim(), priority: 'Medium' })
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (nt) {
      fetchAndRender();
      setTimeout(function () {
        document.getElementById('fParent').value = nt.id;
        fillParent();
        document.getElementById('fParent').value = nt.id;
      }, 300);
    })
    .catch(showErr);
}

function delParent() {
  var id = parseInt(document.getElementById('fParent').value);
  if (!id) {
    alert('Pick a task first.');
    return;
  }

  var t = allTasks.find(function (x) {
    return x.id === id;
  });
  if (!t) return;

  if (!confirm('Delete "' + t.description + '" and its subtasks?')) return;

  fetch(API + '/' + id, { method: 'DELETE' })
    .then(function () {
      document.getElementById('fParent').value = '';
      fetchAndRender();
    })
    .catch(showErr);
}

function saveTask() {
  var desc = document.getElementById('fDesc').value.trim();
  if (!desc) {
    alert('Please write what the task is! 🌸');
    return;
  }

  var endDate = document.getElementById('fDate').value || null;
  if (!endDate && !confirm('⚠️ No date selected!\nThis task will ONLY appear in "All ✨".\n\nContinue without a date?')) return;

  var parentId = parseInt(document.getElementById('fParent').value) || null;
  var id = parseInt(document.getElementById('fId').value) || null;

  var dto = {
    description: desc,
    priority: document.getElementById('fPri').value,
    endDate: endDate,
    note: document.getElementById('fNote').value || null,
    parentId: parentId,
    isCompleted: document.getElementById('fDone').checked
  };

  var url = id ? API + '/' + id : API;
  var method = id ? 'PUT' : 'POST';

  fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) })
    .then(function (r) {
      return r.ok ? r.json().catch(function () { return {}; }) : r.json().then(function (e) { throw e; });
    })
    .then(function (saved) {
      var savedId = id || (saved && saved.id);
      var file = document.getElementById('fFile').files[0];

      if (file && savedId) {
        var fd = new FormData();
        fd.append('file', file);
        return fetch(API + '/' + savedId + '/attachment', { method: 'POST', body: fd })
          .then(function () {
            return { savedId: savedId, endDate: endDate };
          });
      }

      return { savedId: savedId, endDate: endDate };
    })
    .then(function (result) {
      closeModal();

      // jump straight to the day the task was saved for
      if (result.endDate) {
        cur = new Date(result.endDate + 'T12:00:00');
        view = 'day';
        document.querySelectorAll('.tab').forEach(function (t) {
          t.classList.remove('on');
        });
        document.querySelector('[data-v="day"]').classList.add('on');
        document.querySelectorAll('.chip').forEach(function (c) {
          c.classList.remove('onC', 'onM');
        });
        sf = null;
      }

      fetchAndRender();
    })
    .catch(function (err) {
      showErr('Save failed: ' + (err.title || err.message || JSON.stringify(err)));
    });
}

// ---- profile modal ----

function openPM() {
  document.getElementById('pmAv').textContent = prof.av || '🌸';
  document.getElementById('pmName').textContent = prof.name || 'Profile';
  document.getElementById('pmNV').textContent = prof.name || '—';
  document.getElementById('pmEV').textContent = prof.email || '—';
  document.getElementById('pmSt').textContent = allTasks.length + ' task' + (allTasks.length !== 1 ? 's' : '') + ' total';
  document.getElementById('pmOv').classList.remove('h');
}

function closePM() {
  document.getElementById('pmOv').classList.add('h');
}

function updatePUI() {
  document.getElementById('topAv').textContent = prof.av || '🌸';
  document.getElementById('topName').textContent = prof.name || 'Me';
}

// ---- error banner ----

function showErr(e) {
  var msg = typeof e === 'string' ? e : e.message || 'Something went wrong.';
  document.getElementById('errBanner').textContent = msg;
  document.getElementById('errBanner').style.display = 'block';
}

function hideErr() {
  document.getElementById('errBanner').style.display = 'none';
}

// ---- init ----

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

show('pgLogin');