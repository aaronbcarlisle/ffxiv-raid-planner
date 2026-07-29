param(
    [string]$Title = "Claude Code",
    [string]$Message = "Attention needed"
)
# Windows toast via WinRT (works in Windows PowerShell 5.1; falls back to a beep).
try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $texts = $template.GetElementsByTagName("text")
    $texts.Item(0).AppendChild($template.CreateTextNode($Title)) | Out-Null
    $texts.Item(1).AppendChild($template.CreateTextNode($Message)) | Out-Null
    $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Claude Code").Show($toast)
} catch {
    try { [console]::beep(880, 400) } catch {}
}
