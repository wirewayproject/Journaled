
function copyToClipboard(text) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Copied to clipboard', 'success');
}


  if (typeof navigator.serviceWorker !== 'undefined') {
    navigator.serviceWorker.register('/assets/sw.js')
  }




async function handleSubmit(event) {
    event.preventDefault();
    const formTitle = document.getElementById('formTitle').innerText;
    const name = document.getElementById('name').value.trim();
    const password = document.getElementById('password').value.trim();
    const token = document.getElementById('token').value.trim();

    if (!name || !password || !token) {
        showToast('All fields are required!', 'warning');
        return;
    }

    const url = formTitle === 'Login' ? '/login' : '/register';
    const body = formTitle === 'Login' ? { name, password, token } : { name, password, token, secret };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response;
        if (response.ok) {
            data.json().then(jsonData => {
                document.cookie = `token=${jsonData.session.sessionId}; path=/; max-age=86400`; // Set cookie to expire in 1 hour (3600 seconds)
            });
            showToast('Success!', 'success');
        } else {
            data.text().then(text => showToast('Error: ' + text, 'danger'));
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error, 'danger');
    }
}

function switchForm() {
    const formTitle = document.getElementById('formTitle');
    const registerFields = document.getElementById('registerFields');
    const switchFormText = document.getElementById('switchFormText');
    const form = document.getElementById('loginForm');

    if (formTitle.innerText === "Login") {
        formTitle.innerText = "Register";
        registerFields.style.display = "block";
        switchFormText.innerHTML = "<a class='loginlink' href='#' onclick='switchForm()'>Login</a>";
        form.querySelector('input[type="submit"]').value = "Register";
    } else {
        formTitle.innerText = "Login";
        registerFields.style.display = "none";
        switchFormText.innerHTML = "<a class='loginlink' href='#' onclick='switchForm()'>Register</a>";
        form.querySelector('input[type="submit"]').value = "Login";
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '-300px'; // Start off screen
    toast.style.backgroundColor = getToastBackgroundColor(type);
    toast.style.color = 'white';
    toast.style.padding = '10px';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '1000';
    toast.style.transition = 'right 0.5s ease-in-out';
    toast.innerText = message;

    document.body.appendChild(toast);

    // Slide in
    setTimeout(() => {
        toast.style.right = '20px';
    }, 100);

    // Slide out and remove after 4 seconds
    setTimeout(() => {
        toast.style.right = '-300px';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500); // Wait for slide out to finish
    }, 4000);
}

function getToastBackgroundColor(type) {
    switch (type) {
        case 'success':
            return '#2dc937'; // Light green
        case 'danger':
            return '#cc3232'; // Light red
        case 'warning':
            return '#db7b2b'; // Gold
        default:
            return '#D3D3D3'; // Light gray
    }
}

function blockInputsAndShowOverlay(block, inactivityTime) {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.disabled = block;
    });

    let overlay = document.getElementById('noUserOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'noUserOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1000';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.color = 'white';
        overlay.style.fontSize = '24px';
        document.body.appendChild(overlay);
    }

    if (block) {
        const loggedOutin = 30000 - inactivityTime
        const loggedOutInSub = loggedOutin / 1000;
        overlay.innerText = 'No user detected. Please return to continue.\nYou will be logged out in ' + loggedOutInSub.toFixed(0) + " seconds";
        overlay.style.display = 'flex';
        document.getElementById("journalContentTextContainer").style.filter = "blur(8px)";
    } else {
        overlay.style.display = 'none';
        document.getElementById("journalContentTextContainer").style.filter = "";
    }
}

async function submitEntry() {
    const content = document.getElementById('entryContent').value;
    const sessionId = getCookie('token'); // Assuming the session ID is stored in a cookie named 'token'
    try {
        const response = await fetch('/create-entry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content, sessionId }),
        });
        if (!response.ok) {
            throw new Error('Failed to create entry');
        }
        const result = await response.json();
        console.log('Entry created successfully', result);
        fetchEntries()
        document.getElementById('entryContent').value = "";
        showToast('Entry has been created', 'success');


    } catch (error) {
        console.error('Error creating entry:', error);
        // Handle error, e.g., showing an error message
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}


async function fetchEntries() {
    const sessionId = getCookie('token'); // Assuming the session ID is stored in a cookie named 'token'
    try {
        const response = await fetch('/entries/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionId}`
            },
        });
        if (!response.ok) {
            throw new Error('Failed to fetch entries');
        }
        const entries = await response.json();
        console.log('Entries fetched successfully', entries);

        const journalDiv = document.getElementById('journalContentText');
        let lastDate = null;
        journalDiv.innerHTML = ''; // Clear existing content

        entries.reverse(); // Reverse the order of entries

        entries.forEach(entry => {
            const entryDate = new Date(entry.timestamp).toLocaleDateString();
            if (lastDate !== entryDate) {
                const dateElement = document.createElement('div');
                dateElement.innerHTML = `<strong>${entryDate}</strong>`;
                journalDiv.appendChild(dateElement);
                lastDate = entryDate;
            }
            const time = new Date(entry.timestamp).toLocaleTimeString();
            const entryElement = document.createElement('div');
            entryElement.textContent = `${time}: ${entry.content}`;
            journalDiv.appendChild(entryElement);
        });
        // Handle displaying the entries here, e.g., updating the DOM
    } catch (error) {
        console.error('Error fetching entries:', error);
        // Handle error, e.g., showing an error message
    }
}