const API_URL = "http://127.0.0.1:8000";

const registerEmailInput = document.getElementById("registerEmail");
if (registerEmailInput) {
    registerEmailInput.addEventListener("input", () => {
        registerEmailInput.setCustomValidity("");
    });
}

function isValidEmail(email) {
    if (!email || typeof email !== "string") {
        return false;
    }

    const sanitized = email.trim();
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(sanitized);
}

async function loginUser(event) {
    event.preventDefault();

    const message = document.getElementById("loginMessage");
    try {
        const formData = new URLSearchParams();
        formData.append("username", document.getElementById("loginUsername").value.trim());
        formData.append("password", document.getElementById("loginPassword").value);

        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });
        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.detail || "Login failed.";
            return;
        }

        localStorage.setItem("access_token", data.access_token);
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error(error);
        message.textContent = "Could not connect to server.";
    }
}

async function registerUser(event) {
    event.preventDefault();

    const message = document.getElementById("registerMessage");
    const usernameInput = document.getElementById("registerUsername");
    const emailInput = document.getElementById("registerEmail");
    const passwordInput = document.getElementById("registerPassword");
    const roleInput = document.getElementById("registerRole");

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!username) {
        message.textContent = "Username is required.";
        usernameInput.focus();
        return;
    }

    if (!isValidEmail(email)) {
        message.textContent = "Please enter a valid email address.";
        emailInput.focus();
        emailInput.setCustomValidity("Please enter a valid email address.");
        emailInput.reportValidity();
        return;
    }

    emailInput.setCustomValidity("");

    if (!password) {
        message.textContent = "Password is required.";
        passwordInput.focus();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                email,
                password,
                role: roleInput.value
            })
        });
        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.detail || "Registration failed.";
            return;
        }

        message.textContent = "Registration successful! Redirecting to login...";
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1500);
    } catch (error) {
        console.error(error);
        message.textContent = "Could not connect to server.";
    }
}

function decodeJwtPayload(token) {
    if (!token || typeof token !== "string") {
        return null;
    }

    const parts = token.split(".");
    if (parts.length < 2) {
        return null;
    }

    try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
        const binary = atob(padded);
        const json = decodeURIComponent(
            Array.from(binary)
                .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
                .join("")
        );
        return JSON.parse(json);
    } catch (error) {
        console.error("Invalid JWT token", error);
        return null;
    }
}

function checkLogin() {
    const token = localStorage.getItem("access_token");
    if (!token || !decodeJwtPayload(token)) {
        localStorage.removeItem("access_token");
        window.location.href = "index.html";
        return false;
    }
    return true;
}

function getUserRole() {
    return decodeJwtPayload(localStorage.getItem("access_token"))?.role || null;
}

function getUsername() {
    return decodeJwtPayload(localStorage.getItem("access_token"))?.sub || null;
}

function logoutUser() {
    localStorage.removeItem("access_token");
    window.location.href = "index.html";
}

async function apiRequest(path, options = {}) {
    const token = localStorage.getItem("access_token");
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, { ...options, headers });
}

function setAppIdentity() {
    const username = getUsername() || "User";
    const role = getUserRole() || "user";
    const welcome = document.getElementById("welcomeUser");
    const dashboardRole = document.getElementById("dashboardRole");

    if (welcome) {
        welcome.textContent = `Welcome ${username} · ${role}`;
    }
    if (dashboardRole) {
        dashboardRole.textContent = role;
    }
}

async function loadStudents() {
    if (!checkLogin()) {
        return;
    }

    const studentList = document.getElementById("studentList");
    const totalStudents = document.getElementById("totalStudents");
    try {
        const response = await apiRequest("/students");
        const data = await response.json();

        if (response.status === 401) {
            logoutUser();
            return;
        }
        if (!response.ok) {
            throw new Error(data.detail || "Could not load students.");
        }

        if (totalStudents) {
            totalStudents.textContent = String(data.length);
        }
        if (!studentList) {
            return;
        }

        studentList.replaceChildren();
        if (data.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "empty-message";
            emptyMessage.textContent = "No students found.";
            studentList.appendChild(emptyMessage);
            return;
        }

        const isAdmin = getUserRole() === "admin";
        const table = document.createElement("table");
        table.className = "student-table";

        const head = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["ID", "Name", "Email", "Age", "Course", ...(isAdmin ? ["Actions"] : [])]
            .forEach(label => {
                const header = document.createElement("th");
                header.scope = "col";
                header.textContent = label;
                headerRow.appendChild(header);
            });
        head.appendChild(headerRow);

        const body = document.createElement("tbody");
        data.forEach(student => {
            const row = document.createElement("tr");
            [student.id, student.name, student.email, student.age, student.course]
                .forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = String(value);
                    row.appendChild(cell);
                });

            if (isAdmin) {
                const actionCell = document.createElement("td");
                const actions = document.createElement("div");
                actions.className = "student-actions";

                const editButton = document.createElement("button");
                editButton.className = "edit-btn";
                editButton.type = "button";
                editButton.textContent = "Edit";
                editButton.addEventListener("click", () => {
                    window.location.href = `edit-student.html?id=${encodeURIComponent(student.id)}`;
                });

                const deleteButton = document.createElement("button");
                deleteButton.className = "delete-btn";
                deleteButton.type = "button";
                deleteButton.textContent = "Delete";
                deleteButton.addEventListener("click", () => deleteStudent(student.id));

                actions.append(editButton, deleteButton);
                actionCell.appendChild(actions);
                row.appendChild(actionCell);
            }
            body.appendChild(row);
        });

        table.append(head, body);
        studentList.appendChild(table);
    } catch (error) {
        console.error(error);
        if (studentList) {
            studentList.replaceChildren();
            const errorMessage = document.createElement("p");
            errorMessage.className = "empty-message";
            errorMessage.textContent = error.message || "Could not load students.";
            studentList.appendChild(errorMessage);
        }
        if (totalStudents) {
            totalStudents.textContent = "—";
        }
    }
}

async function addStudent(event) {
    event.preventDefault();
    if (!checkLogin()) {
        return;
    }

    const message = document.getElementById("studentMessage");
    const student = {
        name: document.getElementById("studentName").value.trim(),
        email: document.getElementById("studentEmail").value.trim(),
        age: Number(document.getElementById("studentAge").value),
        course: document.getElementById("studentCourse").value.trim()
    };

    try {
        const response = await apiRequest("/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(student)
        });
        const data = await response.json();

        if (response.status === 401) {
            logoutUser();
            return;
        }
        if (!response.ok) {
            message.textContent = data.detail || "Could not add student.";
            return;
        }

        document.getElementById("studentName").value = "";
        document.getElementById("studentEmail").value = "";
        document.getElementById("studentAge").value = "";
        document.getElementById("studentCourse").value = "";
        message.textContent = "Student added successfully.";
        await loadStudents();
    } catch (error) {
        console.error(error);
        message.textContent = "Could not connect to server.";
    }
}

async function loadStudentForEdit(studentId) {
    const message = document.getElementById("editStudentMessage");
    try {
        const response = await apiRequest(`/students/${encodeURIComponent(studentId)}`);
        const data = await response.json();

        if (response.status === 401) {
            logoutUser();
            return;
        }
        if (!response.ok) {
            throw new Error(data.detail || "Could not load this student.");
        }

        document.getElementById("editStudentName").value = data.name;
        document.getElementById("editStudentEmail").value = data.email;
        document.getElementById("editStudentAge").value = data.age;
        document.getElementById("editStudentCourse").value = data.course;
        message.textContent = "";
    } catch (error) {
        console.error(error);
        message.textContent = error.message || "Could not connect to server.";
        document.getElementById("saveStudentButton").disabled = true;
    }
}

async function saveStudent(event) {
    event.preventDefault();
    if (!checkLogin()) {
        return;
    }

    const studentId = new URLSearchParams(window.location.search).get("id");
    const message = document.getElementById("editStudentMessage");
    const student = {
        name: document.getElementById("editStudentName").value.trim(),
        email: document.getElementById("editStudentEmail").value.trim(),
        age: Number(document.getElementById("editStudentAge").value),
        course: document.getElementById("editStudentCourse").value.trim()
    };

    if (!studentId) {
        message.textContent = "Student ID is missing. Return to the student list and try again.";
        return;
    }

    const saveButton = document.getElementById("saveStudentButton");
    saveButton.disabled = true;
    message.textContent = "Saving changes...";
    try {
        const response = await apiRequest(`/students/${encodeURIComponent(studentId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(student)
        });
        const data = await response.json();

        if (response.status === 401) {
            logoutUser();
            return;
        }
        if (!response.ok) {
            message.textContent = data.detail || "Could not update student.";
            return;
        }

        window.location.href = "students.html";
    } catch (error) {
        console.error(error);
        message.textContent = "Could not connect to server.";
    } finally {
        saveButton.disabled = false;
    }
}

async function deleteStudent(studentId) {
    if (!checkLogin() || !confirm("Are you sure you want to delete this student?")) {
        return;
    }

    try {
        const response = await apiRequest(`/students/${encodeURIComponent(studentId)}`, {
            method: "DELETE"
        });
        const data = await response.json();

        if (response.status === 401) {
            logoutUser();
            return;
        }
        if (!response.ok) {
            alert(data.detail || "Could not delete student.");
            return;
        }
        await loadStudents();
    } catch (error) {
        console.error(error);
        alert("Could not connect to server.");
    }
}

function initializeApp() {
    const path = window.location.pathname;
    const isDashboard = path.endsWith("dashboard.html");
    const isStudentsPage = path.endsWith("students.html");
    const isEditPage = path.endsWith("edit-student.html");
    if (!isDashboard && !isStudentsPage && !isEditPage) {
        return;
    }
    if (!checkLogin()) {
        return;
    }

    setAppIdentity();
    const isAdmin = getUserRole() === "admin";
    const addStudentSection = document.getElementById("addStudentSection");
    const userAccessNotice = document.getElementById("userAccessNotice");
    if (!isAdmin && addStudentSection) {
        addStudentSection.hidden = true;
    }
    if (!isAdmin && userAccessNotice) {
        userAccessNotice.hidden = false;
    }
    if (isEditPage && !isAdmin) {
        window.location.replace("students.html");
        return;
    }

    if (isDashboard || isStudentsPage) {
        loadStudents();
    }
    if (isEditPage) {
        const studentId = new URLSearchParams(window.location.search).get("id");
        if (!studentId) {
            document.getElementById("editStudentMessage").textContent =
                "Student ID is missing. Return to the student list and select Edit.";
            document.getElementById("saveStudentButton").disabled = true;
            return;
        }
        loadStudentForEdit(studentId);
    }
}

initializeApp();
