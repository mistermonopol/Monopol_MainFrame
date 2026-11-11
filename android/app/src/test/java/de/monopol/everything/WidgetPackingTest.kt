package de.monopol.everything

import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetPackingTest {
    @Test fun mobilePreservesOrderAndPairsHalfWidthWidgets(){
        assertEquals(listOf(listOf(0,1),listOf(2),listOf(3)),packWidgetRows(listOf(1,1,2,1),2))
    }
    @Test fun desktopRowsNeverOverlapAndClampBadCacheSizes(){
        assertEquals(listOf(listOf(0,1),listOf(2),listOf(3,4)),packWidgetRows(listOf(6,6,99,0,3),12))
    }
    @Test fun emptyWorkspaceIsValid(){assertEquals(emptyList<List<Int>>(),packWidgetRows(emptyList(),2))}
}
