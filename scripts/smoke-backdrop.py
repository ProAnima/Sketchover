"""Синее окно во весь экран — подложка под холст для проверки прозрачности на Linux (smoke.yml).

Под композитором xcompmgr фон корневого окна не рисуется, и снимок «до» был бы чёрным:
нужно настоящее окно, которое либо видно сквозь холст, либо нет.
"""
import tkinter

root = tkinter.Tk()
root.geometry(f'{root.winfo_screenwidth()}x{root.winfo_screenheight()}+0+0')
root.configure(bg='#3a6ea5')
root.mainloop()
