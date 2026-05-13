<?php
session_start();
require_once __DIR__ . "/includes/db.php";

$message = "";

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = trim($_POST["email"]);
    $password = $_POST["password"];

    $sql = "SELECT * FROM users WHERE email = :email";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([":email" => $email]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user["password_hash"])) {
        $_SESSION["user_id"] = $user["user_id"];
        $_SESSION["username"] = $user["username"];

        header("Location: feed.php");
        exit();
    } else {
        $message = "❌ E-Mail oder Passwort ist falsch.";
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>OnTrack Login</title>
  <link rel="stylesheet" href="style.css">
</head>

<body class="feed">

<header class="main-header">
  <div class="middle-logo">
    <img src="/ontrack/images/logo.png" class="login-logo">
  </div>
</header>

<main class="login-main">
  <form class="login-box" action="login.php" method="POST">

    <h2>Login</h2>

    <?php if ($message): ?>
      <div class="error-message">
        <?php echo $message; ?>
      </div>
    <?php endif; ?>

    <label>E-Mail:</label>
    <input type="email" name="email" required>

    <label>Passwort:</label>
    <input type="password" name="password" required>

    <button type="submit">Login</button>

    <p>Noch keinen Account? <a href="register.php">Registrieren</a></p>

  </form>
</main>

</body>
</html>