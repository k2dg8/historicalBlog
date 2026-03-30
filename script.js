document.addEventListener('DOMContentLoaded', () => {

    // 1. Load Trending Posts
    const trendingGrid = document.getElementById('trending-container');
    if (trendingGrid) {
        fetch('/api/trending')
            .then(res => res.json())
            .then(posts => {
                trendingGrid.innerHTML = posts.map(post => `
                    <article class="post-card">
                        <img src="${post.imageUrl}" alt="${post.title}">
                        <div class="post-content">
                            <h3>${post.title}</h3>
                            <p>${post.description}</p>
                            <a href="#" class="read-more">Read More</a>
                        </div>
                    </article>
                `).join('');
            });
    }

    // 2. Contact Form Submission
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                message: document.getElementById('message').value
            };
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            if (res.ok) {
                alert("Message Saved!");
                contactForm.reset();
            }
        });
    }

    // 3. Admin Login & Table
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const password = document.getElementById('admin-password').value;
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('messages-table').style.display = 'table';
                loadMessages();
            } else {
                document.getElementById('login-error').style.display = 'block';
            }
        });
    }
});

async function loadMessages() {
    const res = await fetch('/api/messages');
    const messages = await res.json();
    const body = document.getElementById('messages-body');
    body.innerHTML = messages.map(msg => `
        <tr>
            <td>${new Date(msg.date_submitted).toLocaleString()}</td>
            <td>${msg.name}</td>
            <td><a href="mailto:${msg.email}">${msg.email}</a></td>
            <td>${msg.message}</td>
        </tr>
    `).join('');
}