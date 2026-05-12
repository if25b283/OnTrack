<?php

$host = "aws-1-eu-central-1.pooler.supabase.com";
$port = "5432";
$dbname = "postgres";
$user = "postgres.twulcygrmhcpbrqbiicj";
$password = "OnTrack!2026#";

try {
    $pdo = new PDO(
        "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require",
        $user,
        $password
    );

    // Fehler sichtbar machen
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("❌ Verbindung fehlgeschlagen: " . $e->getMessage());
}
