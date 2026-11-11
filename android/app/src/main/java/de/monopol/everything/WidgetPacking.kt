package de.monopol.everything

/** Stable row packing, with no overlaps and no discarded widgets. */
fun packWidgetRows(widths:List<Int>,columns:Int):List<List<Int>> {
    require(columns>0)
    val rows=mutableListOf<MutableList<Int>>()
    var used=0
    widths.forEachIndexed{index,value->
        val width=value.coerceIn(1,columns)
        if(rows.isEmpty()||used+width>columns){rows.add(mutableListOf());used=0}
        rows.last().add(index);used+=width
    }
    return rows
}
