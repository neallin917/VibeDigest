const app = {
    supabase: null,
    user: null,
    currentTask: null,
    realtimeChannel: null,

    async init() {
        // 1. Fetch Config
        try {
            const res = await fetch('/api/config');
            const config = await res.json();
            if (!config.supabase_url || !config.supabase_key) {
                alert("Supabase config (URL/KEY) missing on backend!");
                return;
            }
            // 2. Init Supabase
            this.supabase = supabase.createClient(config.supabase_url, config.supabase_key);

            // 3. Auth Listener
            this.supabase.auth.onAuthStateChange((event, session) => {
                this.user = session?.user || null;
                this.updateNav();
                if (this.user) {
                    this.router('home'); // or keep current if valid
                } else {
                    this.router('login');
                }
            });
        } catch (e) {
            console.error(e);
            alert("Failed to initialize app.");
        }
    },

    // --- Auth ---
    async loginGoogle() {
        await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin // standard redirect
            }
        });
    },

    async loginWallet() {
        if (!window.ethereum) {
            return alert("No wallet found. Please install MetaMask.");
        }

        console.log("Starting Wallet Login...");

        // Check if function exists
        if (typeof this.supabase.auth.signInWithWeb3 !== 'function') {
            alert("Error: signInWithWeb3 is not supported in this Supabase client version. Please check console.");
            console.error("signInWithWeb3 is missing from supabase.auth", this.supabase.auth);
            return;
        }

        try {
            // Official Supabase Web3 Auth Flow relies on implicit window.ethereum
            const { data, error } = await this.supabase.auth.signInWithWeb3({
                chain: 'ethereum',
                statement: 'Sign in to AI Video Transcriber'
            });

            if (error) {
                console.error("Supabase Web3 Error:", error);
                throw error;
            }
            console.log("Wallet login successful", data);
            // Successful login will update session and trigger onAuthStateChange

        } catch (e) {
            console.error("Wallet login exception:", e);
            alert("Wallet login failed: " + (e.message || e));
        }
    },

    async loginEmail() {
        const email = document.getElementById('email').value;
        if (!email) return alert("Enter email");
        const { error } = await this.supabase.auth.signInWithOtp({ email });
        if (error) alert(error.message);
        else alert("Check your email for the login link!");
    },

    async logout() {
        await this.supabase.auth.signOut();
    },

    updateNav() {
        const nav = document.getElementById('navMenu');
        const emailDisplay = document.getElementById('userEmail');
        if (this.user) {
            nav.style.display = 'flex';
            emailDisplay.textContent = this.user.email;
        } else {
            nav.style.display = 'none';
        }
    },

    // --- Router ---
    router(viewName, params = {}) {
        if (!this.user && viewName !== 'login') {
            viewName = 'login';
        }

        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${viewName}`).classList.add('active');

        // Cleanup
        if (this.realtimeChannel) {
            this.realtimeChannel.unsubscribe();
            this.realtimeChannel = null;
        }

        // Init View
        if (viewName === 'list') {
            this.loadTasks();
        } else if (viewName === 'detail') {
            this.loadDetail(params.id);
        }
    },

    // --- Views Logic ---

    // HOME
    async submitTask() {
        const url = document.getElementById('videoUrl').value;
        if (!url) return alert("Enter URL");

        const summaryLang = document.getElementById('summaryLang').value;
        const transTargets = Array.from(document.querySelectorAll('input[name="transTarget"]:checked')).map(cb => cb.value);

        // Get Token
        const { data: { session } } = await this.supabase.auth.getSession();

        const formData = new FormData();
        formData.append('video_url', url);
        formData.append('summary_language', summaryLang);
        formData.append('translate_targets', JSON.stringify(transTargets));

        try {
            const res = await fetch('/api/process-video', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || "Error");

            // Go to list or detail?
            this.router('list'); // or router('detail', {id: json.task_id})
        } catch (e) {
            alert(e.message);
        }
    },

    // LIST
    async loadTasks() {
        const listEl = document.getElementById('taskList');
        listEl.innerHTML = '<p>Loading...</p>';

        // Fetch users tasks
        const { data, error } = await this.supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            listEl.innerHTML = `<p style="color:red">${error.message}</p>`;
            return;
        }

        listEl.innerHTML = '';
        if (data.length === 0) {
            listEl.innerHTML = '<p>No tasks found.</p>';
            return;
        }

        data.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item';
            item.onclick = () => this.router('detail', { id: task.id });
            const date = new Date(task.created_at).toLocaleString();
            item.innerHTML = `
                <div>
                    <strong>${task.video_title || task.video_url}</strong>
                    <div style="font-size: 0.8em; color: gray;">${date}</div>
                </div>
                <div class="status-badge status-${task.status}">${task.status} (${task.progress}%)</div>
            `;
            listEl.appendChild(item);
        });

        // Subscribe to changes (global list update)
        // Optimization: For now just refresh button, or simple subscription
        // Realtime for list is optional for MVP, but cool.
        this.realtimeChannel = this.supabase.channel('list_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${this.user.id}` }, (payload) => {
                // Brute force reload for simplicity
                this.loadTasks();
            })
            .subscribe();
    },

    // DETAIL
    async loadDetail(taskId) {
        this.currentTaskId = taskId;
        const titleEl = document.getElementById('detailTitle');
        const statusEl = document.getElementById('detailStatus');
        const progressEl = document.getElementById('detailProgress');

        titleEl.textContent = 'Loading...';

        // 1. Fetch Task
        const { data: task } = await this.supabase.from('tasks').select('*').eq('id', taskId).single();
        if (task) {
            titleEl.textContent = task.video_title || task.video_url;
            statusEl.textContent = task.status;
            statusEl.className = `status-badge status-${task.status}`;
            progressEl.style.width = `${task.progress}%`;
        }

        // 2. Fetch Outputs
        this.loadOutputs(taskId);

        // 3. Realtime Subscription
        this.realtimeChannel = this.supabase.channel(`task_${taskId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` }, (payload) => {
                const newT = payload.new;
                statusEl.textContent = newT.status;
                statusEl.className = `status-badge status-${newT.status}`;
                progressEl.style.width = `${newT.progress}%`;
                titleEl.textContent = newT.video_title || newT.video_url;
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_outputs', filter: `task_id=eq.${taskId}` }, (payload) => {
                // Reload outputs or update specific logic
                this.loadOutputs(taskId);
            })
            .subscribe();
    },

    async loadOutputs(taskId) {
        const { data: outputs } = await this.supabase.from('task_outputs').select('*').eq('task_id', taskId);

        // Group by Kind
        const script = outputs.find(o => o.kind === 'script');
        const summary = outputs.find(o => o.kind === 'summary');
        const translations = outputs.filter(o => o.kind === 'translation');

        // Render
        this.renderMarkdown('scriptContent', script);
        this.renderMarkdown('summaryContent', summary);

        const transContainer = document.getElementById('translationContainer');
        transContainer.innerHTML = '';
        translations.forEach(t => {
            const div = document.createElement('div');
            div.className = 'card markdown-content';
            div.innerHTML = `<h3>${t.locale} (${t.status})</h3>`;
            const contentDiv = document.createElement('div');
            this.renderMarkdownDiv(contentDiv, t);
            div.appendChild(contentDiv);
            transContainer.appendChild(div);
        });
    },

    renderMarkdown(elementId, output) {
        const el = document.getElementById(elementId);
        this.renderMarkdownDiv(el, output);
    },

    renderMarkdownDiv(el, output) {
        if (!output) {
            el.innerHTML = '<p>Not created.</p>';
            return;
        }
        if (output.status === 'processing' || output.status === 'pending') {
            el.innerHTML = `<p>Processing... ${output.progress}%</p>`;
            return;
        }
        if (output.status === 'error') {
            el.innerHTML = `<p style="color: red">Error: ${output.error_message} <button class="btn" style="padding: 2px 8px" onclick="app.retryOutput('${output.id}')">Retry</button></p>`;
            return;
        }
        if (output.content) {
            el.innerHTML = marked.parse(output.content);
        }
    },

    async retryOutput(outputId) {
        // Call Backend API
        const { data: { session } } = await this.supabase.auth.getSession();
        const formData = new FormData();
        formData.append('output_id', outputId);

        fetch('/api/retry-output', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            body: formData
        });
        // Realtime will catch the status update to "pending"
    },

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        document.querySelector(`.tab-btn[onclick="app.switchTab('${tabName}')"]`).classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
