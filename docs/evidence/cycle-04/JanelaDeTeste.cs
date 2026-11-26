using System;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

internal static class JanelaDeTeste
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length != 0 || Path.GetFileNameWithoutExtension(
            Assembly.GetExecutingAssembly().Location).EndsWith("-falha", StringComparison.Ordinal))
            return 42;

        Application.EnableVisualStyles();
        using (var window = new Form())
        {
            window.Text = "Aurora Central - janela de teste do Ciclo 04";
            window.Width = 480;
            window.Height = 200;
            window.Controls.Add(new Label
            {
                AutoSize = true,
                Left = 18,
                Top = 24,
                Text = "Janela local para conferir abertura, foco e encerramento."
            });
            Application.Run(window);
        }
        return 0;
    }
}
